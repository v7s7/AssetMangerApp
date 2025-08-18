#!/usr/bin/env python3
import argparse
import datetime
import json
import socket
import sys
import re
import time

import nmap
import requests

# Optional deps; handle gracefully if missing or running non-admin
try:
    import wmi
except Exception:
    wmi = None

try:
    from scapy.all import ARP, Ether, srp  # type: ignore
except Exception:
    ARP = Ether = srp = None  # scapy not available / no admin

API_ROOT_DEFAULT = "http://swdapp:4000"
TARGET_DEFAULT = "10.27.16.0/24"
WMI_USERNAME = "os-admin"
WMI_PASSWORD = "Bahrain@2024"
REQ_TIMEOUT = 8  # seconds for HTTP calls

# Per-scan ID cache so previewed devices get sequential IDs even before DB insert
_id_state = {}  # {assetType: {"prefix": str, "num": int}}

def log(line: str):
    print(line, file=sys.stderr, flush=True)

def parse_args():
    p = argparse.ArgumentParser(description="Asset auto-discovery and uploader")
    p.add_argument("--target", default=TARGET_DEFAULT,
                   help="IP, range (a-b), or CIDR (e.g., 10.27.16.0/24)")
    p.add_argument("--api-url", default=API_ROOT_DEFAULT,
                   help="API root (no trailing slash), e.g., http://host:4000")
    p.add_argument("--dry-run", action="store_true",
                   help="Do not POST; just output discovered assets")
    p.add_argument("--json", action="store_true",
                   help="When dry-run, print JSON list to stdout")

    # NEW: auth options (for protected APIs)
    p.add_argument("--bearer", help="Bearer token for API (Authorization: Bearer …)")
    p.add_argument("--basic-user", help="HTTP Basic username")
    p.add_argument("--basic-pass", help="HTTP Basic password")

    # NEW: behavior controls
    p.add_argument("--skip-wmi", action="store_true", help="Skip WMI collection")
    p.add_argument("--skip-arp", action="store_true", help="Skip ARP MAC resolution")
    p.add_argument("--skip-os", action="store_true", help="Skip nmap OS detection (-O)")
    p.add_argument("--throttle", type=float, default=0.35,
                   help="Seconds to sleep between POSTs (protects SQLite). Default 0.35s")
    p.add_argument("--max-hosts", type=int, default=0,
                   help="Limit number of hosts processed (0 = no limit)")
    p.add_argument("--no-api", action="store_true",
                   help="Do not call API for /assets or /next-id (treat as offline discovery)")
    return p.parse_args()

def make_session(args) -> requests.Session | None:
    if args.no_api:
        return None
    s = requests.Session()
    if args.bearer:
        s.headers.update({"Authorization": f"Bearer {args.bearer}"})
    elif args.basic_user and args.basic_pass:
        s.auth = (args.basic_user, args.basic_pass)
    return s

def safe_gethostbyaddr(ip: str) -> str:
    try:
        return socket.gethostbyaddr(ip)[0]
    except Exception:
        return "Unknown"

def get_mac_address(ip: str, skip_arp: bool) -> str:
    if skip_arp or ARP is None or Ether is None or srp is None:
        return "Unknown"
    try:
        arp = ARP(pdst=ip)
        ether = Ether(dst="ff:ff:ff:ff:ff:ff")
        result = srp(ether / arp, timeout=2, verbose=False)[0]
        if result:
            return result[0][1].hwsrc
    except Exception as e:
        log(f"ARP error {ip}: {e}")
    return "Unknown"

def scan_device(ip: str, skip_wmi: bool, skip_os: bool, skip_arp: bool):
    log(f"Scanning: {ip}")
    data = {
        "ip": ip, "hostname": safe_gethostbyaddr(ip), "os": "Unknown", "cpu": "Unknown",
        "ram": "Unknown", "storage": "Unknown", "free_storage": "Unknown",
        "bios_version": "Unknown", "domain_workgroup": "Unknown",
        "logged_in_user": "Unknown", "uptime": "Unknown",
        "mac": "Unknown", "manufacturer": "Unknown", "model": "Unknown",
        "serial_number": "Unknown", "ports": [],
    }

    # Nmap: fast scan; OS detect optional
    try:
        nm = nmap.PortScanner()
        # -T4 (faster), -F (fast ports). OS detection only if requested.
        args = "-T4 -F"
        if not skip_os:
            args += " -O"
        nm.scan(ip, arguments=args)
        if ip in nm.all_hosts():
            if not skip_os and "osmatch" in nm[ip] and nm[ip]["osmatch"]:
                data["os"] = nm[ip]["osmatch"][0]["name"]
            if "tcp" in nm[ip]:
                data["ports"] = [
                    f"{p} ({nm[ip]['tcp'][p]['name']})"
                    for p in nm[ip]["tcp"]
                    if nm[ip]["tcp"][p]["state"] == "open"
                ]
            mac_guess = nm[ip]["addresses"].get("mac")
            if mac_guess:
                data["mac"] = mac_guess
    except Exception as e:
        log(f"Nmap error {ip}: {e}")

    if data["mac"] == "Unknown":
        data["mac"] = get_mac_address(ip, skip_arp)

    # WMI block
    if not skip_wmi and wmi is not None:
        try:
            local_ips = socket.gethostbyname_ex(socket.gethostname())[2]
            is_local = ip in local_ips or ip == "localhost"
            conn = wmi.WMI() if is_local else wmi.WMI(computer=ip, user=WMI_USERNAME, password=WMI_PASSWORD)

            os_info = conn.Win32_OperatingSystem()[0]
            cs_info = conn.Win32_ComputerSystem()[0]
            bios_info = conn.Win32_BIOS()[0]
            cpu_info = conn.Win32_Processor()[0]
            product_info = conn.Win32_ComputerSystemProduct()[0]

            total_storage = sum(int(d.Size) for d in conn.Win32_LogicalDisk(DriveType=3))
            free_storage = sum(int(d.FreeSpace) for d in conn.Win32_LogicalDisk(DriveType=3))
            last_boot = datetime.datetime.strptime(os_info.LastBootUpTime.split('.')[0], '%Y%m%d%H%M%S')
            uptime = datetime.datetime.now() - last_boot

            data.update({
                "os": f"{os_info.Caption} {os_info.Version}",
                "cpu": cpu_info.Name,
                "ram": str(round(int(cs_info.TotalPhysicalMemory) / (1024 ** 3))),
                "storage": str(round(total_storage / (1024 ** 3))),
                "free_storage": str(round(free_storage / (1024 ** 3))),
                "bios_version": getattr(bios_info, "SMBIOSBIOSVersion", "Unknown"),
                "domain_workgroup": cs_info.Domain,
                "logged_in_user": cs_info.UserName,
                "uptime": str(uptime).split('.')[0],
                "manufacturer": getattr(cs_info, "Manufacturer", "Unknown"),
                "model": getattr(product_info, "Name", "Unknown"),
                "serial_number": getattr(product_info, "IdentifyingNumber", "Unknown"),
            })
        except Exception as e:
            log(f"WMI error {ip}: {e}")

    return data

def auto_detect_group_and_type(os_name, model):
    os_name = (os_name or "").lower()
    model = (model or "").lower()
    if "windows" in os_name:
        return "Windows", "PC"
    if any(k in os_name for k in ["linux", "ubuntu", "debian", "centos", "rhel"]):
        return "Servers & Infra", "Server"
    if any(k in os_name for k in ["ios", "android"]):
        return "Mobile Device", "Mobile Phones"
    if any(k in model for k in ["vmware", "hyper-v"]):
        return "Servers & Infra", "Server"
    return "Windows", "PC"

def get_next_asset_id(sess: requests.Session | None, api_root: str, asset_type: str):
    if sess is None:
        return "UNK-001"
    try:
        encoded_type = requests.utils.quote(asset_type)
        url = f"{api_root}/assets/next-id/{encoded_type}"
        res = sess.get(url, timeout=REQ_TIMEOUT)
        if res.status_code == 200:
            return res.json().get("id", "UNK-001")
        if res.status_code == 401:
            log("Next-ID 401 Unauthorized; proceeding with UNK-001 (use --bearer/--basic-user).")
        else:
            log(f"Next-ID failed {asset_type}: {res.status_code} {res.text}")
    except Exception as e:
        log(f"Next-ID error: {e}")
    return "UNK-001"

def _propose_id(sess: requests.Session | None, api_root: str, asset_type: str):
    """
    Propose a unique ID per scan session by caching the first DB-assigned ID
    per assetType and incrementing locally for subsequent items of same type.
    """
    key = (asset_type or "GEN").upper()
    st = _id_state.get(key)
    if not st:
        base = get_next_asset_id(sess, api_root, key)  # e.g., PC-004
        m = re.match(r"^([A-Z0-9]+)-(\d+)$", base or "")
        if m:
            prefix, num = m.group(1), int(m.group(2))
        else:
            prefix, num = (key[:3] or "GEN"), 1
        st = {"prefix": prefix, "num": num}
        _id_state[key] = st
        return f"{prefix}-{str(num).zfill(3)}"
    else:
        st["num"] += 1
        return f"{st['prefix']}-{str(st['num']).zfill(3)}"

def load_existing(sess: requests.Session | None, api_root: str):
    macs, ips = set(), set()
    if sess is None:
        return macs, ips
    try:
        res = sess.get(f"{api_root}/assets", timeout=REQ_TIMEOUT)
        if res.status_code == 200:
            for a in res.json():
                m = (a or {}).get("macAddress")
                i = (a or {}).get("ipAddress")
                if m: macs.add(m)
                if i: ips.add(i)
        elif res.status_code == 401:
            log("Load-existing 401 Unauthorized; continuing with empty cache (use --bearer/--basic-user).")
        else:
            log(f"Load-existing failed: {res.status_code} {res.text}")
    except Exception as e:
        log(f"Load-existing error: {e}")
    return macs, ips

def is_duplicate(macs_set, ips_set, mac, ip):
    return (mac and mac in macs_set) or (ip and ip in ips_set)

def format_for_upload(sess: requests.Session | None, api_root: str, info: dict):
    group, assetType = auto_detect_group_and_type(info.get("os", ""), info.get("model", ""))  # noqa
    asset_id = _propose_id(sess, api_root, assetType)  # local sequential IDs per scan
    return {
        "assetId": asset_id,
        "group": group,
        "assetType": assetType,
        "brandModel": f"{info.get('manufacturer')} {info.get('model')}".strip(),
        "serialNumber": info.get("serial_number"),
        "assignedTo": info.get("logged_in_user"),
        "ipAddress": info.get("ip"),
        "macAddress": info.get("mac"),
        "osFirmware": info.get("os"),
        "cpu": info.get("cpu"),
        "ram": info.get("ram"),
        "storage": info.get("storage"),
        "portDetails": ", ".join(info.get("ports") or []),
        "powerConsumption": "",
        "purchaseDate": "",
        "warrantyExpiry": "",
        "eol": "",
        "maintenanceExpiry": "",
        "cost": "",
        "depreciation": "",
        "residualValue": "",
        "status": "",
        "condition": "",
        "usagePurpose": "",
        "accessLevel": "",
        "licenseKey": "",
        "complianceStatus": "",
        "documentation": "",
        "remarks": "",
        "lastAuditDate": "",
        "disposedDate": "",
        "replacementPlan": ""
    }

def discover_hosts(target_str: str):
    log(f"Start scan: {target_str}")
    nm = nmap.PortScanner()
    # -sn = ping scan only (discover up hosts)
    nm.scan(hosts=target_str, arguments="-sn -T4")
    up = [h for h in nm.all_hosts() if nm[h].state() == "up"]
    log(f"Hosts up: {len(up)}")
    return up

def post_with_retry(sess: requests.Session, url: str, payload: dict,
                    tries: int = 5, base_delay: float = 0.3):
    last = None
    for attempt in range(1, tries + 1):
        try:
            r = sess.post(url, json=payload, timeout=REQ_TIMEOUT)
            if r.status_code in (200, 201):
                return r
            if r.status_code == 401:
                raise RuntimeError("Unauthorized (401). Provide --bearer or --basic-user/--basic-pass.")
            # Retry on 409/429/503 or sqlite lock hints
            if r.status_code in (409, 429, 503) or "locked" in r.text.lower():
                time.sleep(base_delay * (2 ** (attempt - 1)))
                continue
            r.raise_for_status()
            return r
        except Exception as e:
            last = e
            time.sleep(base_delay * (2 ** (attempt - 1)))
    raise RuntimeError(f"POST failed after retries: {last}")

def main():
    args = parse_args()
    api_root = args.api_url.rstrip("/")
    assets_url = f"{api_root}/assets"
    target = args.target

    sess = make_session(args)
    discovered_payloads = []
    macs_set, ips_set = load_existing(sess, api_root)
    seen = 0
    added = 0
    skipped = 0

    hosts = discover_hosts(target)
    if args.max_hosts and args.max_hosts > 0:
        hosts = hosts[:args.max_hosts]

    for ip in hosts:
        seen += 1
        try:
            info = scan_device(ip, skip_wmi=args.skip_wmi, skip_os=args.skip_os, skip_arp=args.skip_arp)
            mac = info.get("mac")
            ipaddr = info.get("ip")

            if is_duplicate(macs_set, ips_set, mac, ipaddr):
                skipped += 1
                log(f"Duplicate: {ip} (skipped)")
                continue

            payload = format_for_upload(sess, api_root, info)

            if args.dry_run:
                discovered_payloads.append(payload)
                log(f"Prepared: {ip} → {payload['assetId']}")
            else:
                if sess is None:
                    raise RuntimeError("--no-api given but not in --dry-run mode")
                res = post_with_retry(sess, assets_url, payload)
                added += 1
                if payload.get("macAddress"):
                    macs_set.add(payload["macAddress"])
                if payload.get("ipAddress"):
                    ips_set.add(payload["ipAddress"])
                log(f"Registered: {ip} → {payload['assetId']}")
                # Throttle to protect SQLite
                if args.throttle > 0:
                    time.sleep(args.throttle)

        except Exception as e:
            log(f"Error {ip}: {e}")

    log(f"Done. Seen: {seen}, Prepared/Added: {added if not args.dry_run else len(discovered_payloads)}, Skipped: {skipped}")

    if args.dry_run and args.json:
        print(json.dumps(discovered_payloads, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
