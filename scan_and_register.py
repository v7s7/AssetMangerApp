import requests
import socket
import datetime
import nmap
import wmi
import re
from scapy.all import ARP, Ether, srp

# === CONFIG ===
API_BASE = "http://10.27.16.58:4000/assets"
SUBNET = "10.27.16.217"
WMI_USERNAME = "os-admin"
WMI_PASSWORD = "Bahrain@2024"

def get_mac_address(ip):
    try:
        arp = ARP(pdst=ip)
        ether = Ether(dst="ff:ff:ff:ff:ff:ff")
        result = srp(ether / arp, timeout=2, verbose=False)[0]
        if result:
            return result[0][1].hwsrc
    except:
        pass
    return "Unknown"

def scan_device(ip):
    print(f"[•] Scanning {ip}")
    data = {
        "ip": ip,
        "hostname": "Unknown",
        "os": "Unknown",
        "cpu": "Unknown",
        "ram": "Unknown",
        "storage": "Unknown",
        "free_storage": "Unknown",
        "bios_version": "Unknown",
        "domain_workgroup": "Unknown",
        "logged_in_user": "Unknown",
        "uptime": "Unknown",
        "mac": "Unknown",
        "manufacturer": "Unknown",
        "model": "Unknown",
        "serial_number": "Unknown",
        "ports": [],
    }

    try:
        data["hostname"] = socket.gethostbyaddr(ip)[0]
    except:
        pass

    try:
        nm = nmap.PortScanner()
        nm.scan(ip, arguments="-T4 -F -O")
        if ip in nm.all_hosts():
            if "osmatch" in nm[ip] and nm[ip]["osmatch"]:
                data["os"] = nm[ip]["osmatch"][0]["name"]
            if "tcp" in nm[ip]:
                data["ports"] = [
                    f"{p} ({nm[ip]['tcp'][p]['name']})"
                    for p in nm[ip]["tcp"]
                    if nm[ip]["tcp"][p]["state"] == "open"
                ]
            data["mac"] = nm[ip]["addresses"].get("mac", "Unknown")
    except Exception as e:
        print(f"[-] Nmap failed: {e}")

    if data["mac"] == "Unknown":
        data["mac"] = get_mac_address(ip)

    local_ips = socket.gethostbyname_ex(socket.gethostname())[2]
    is_local = ip in local_ips or ip == "localhost"
    try:
        if is_local:
            conn = wmi.WMI()
        else:
            conn = wmi.WMI(computer=ip, user=WMI_USERNAME, password=WMI_PASSWORD)

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
        print(f"[-] WMI failed for {ip}: {e}")

    return data

def auto_detect_group_and_type(os_name, model):
    os_name = (os_name or "").lower()
    model = (model or "").lower()
    if "windows" in os_name:
        return "Windows", "PC"
    elif any(k in os_name for k in ["linux", "ubuntu"]):
        return "Servers & Infra", "Server"
    elif any(k in os_name for k in ["ios", "android"]):
        return "Mobile Device", "Mobile Phones"
    elif any(k in model for k in ["vmware", "hyper-v"]):
        return "Servers & Infra", "Server"
    return "Windows", "PC"

def get_next_asset_id(asset_type):
    try:
        encoded_type = requests.utils.quote(asset_type)
        res = requests.get(f"{API_BASE.replace('/assets', '')}/assets/next-id/{encoded_type}")
        if res.status_code == 200:
            return res.json().get("id", "UNK-001")
        else:
            print(f"[-] Failed to get next ID for {asset_type}: {res.status_code}")
    except Exception as e:
        print(f"[-] Error fetching asset ID: {e}")
    return "UNK-001"

def is_duplicate(mac, ip):
    try:
        res = requests.get(API_BASE)
        if res.status_code != 200:
            return False
        existing = res.json()
        for a in existing:
            if a.get("macAddress") == mac or a.get("ipAddress") == ip:
                return True
    except:
        pass
    return False

def format_for_upload(info):
    group, assetType = auto_detect_group_and_type(info.get("os", ""), info.get("model", ""))
    asset_id = get_next_asset_id(assetType)

    return {
        "assetId": asset_id,
        "group": group,
        "assetType": assetType,
        "brandModel": f"{info.get('manufacturer')} {info.get('model')}",
        "serialNumber": info.get("serial_number"),
        "assignedTo": info.get("logged_in_user"),
        "ipAddress": info.get("ip"),
        "macAddress": info.get("mac"),
        "osFirmware": info.get("os"),
        "cpu": info.get("cpu"),
        "ram": info.get("ram"),
        "storage": info.get("storage"),
        "portDetails": ", ".join(info.get("ports")),
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

def discover_hosts():
    print(f"[*] Scanning subnet {SUBNET}...")
    nm = nmap.PortScanner()
    nm.scan(hosts=SUBNET, arguments="-sn")
    return [h for h in nm.all_hosts() if nm[h].state() == "up"]

def main():
    for ip in discover_hosts():
        try:
            info = scan_device(ip)
            if is_duplicate(info.get("mac"), info.get("ip")):
                print("[!] Duplicate. Skipping.")
                continue
            payload = format_for_upload(info)
            res = requests.post(API_BASE, json=payload)
            if res.status_code in [200, 201]:
                print(f"[+] Registered {ip} with ID {payload['assetId']}")
            else:
                print(f"[-] Failed {ip}: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"[-] Error with {ip}: {e}")

if __name__ == "__main__":
    main()