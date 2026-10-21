#!/usr/bin/env python3
"""Connect to the local mock SFTP server and list ~/edi-sftp."""

import sys

import paramiko

HOST = "127.0.0.1"
PORT = 2222
USERNAME = "edi-test"
PASSWORD = "edi-test"


def main():
    transport = paramiko.Transport((HOST, PORT))
    try:
        transport.connect(username=USERNAME, password=PASSWORD)
        sftp = paramiko.SFTPClient.from_transport(transport)
        names = sorted(item.filename for item in sftp.listdir_attr("."))
        print("Connected. Files in ~/edi-sftp:")
        print("\n".join(names) if names else "(empty)")
        return 0
    except Exception as exc:
        print(f"SFTP test failed: {exc}", file=sys.stderr)
        return 1
    finally:
        transport.close()


if __name__ == "__main__":
    sys.exit(main())
