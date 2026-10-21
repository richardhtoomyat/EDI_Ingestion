#!/usr/bin/env python3
"""Local mock customer SFTP server for EDI connection tests.

Listens on 0.0.0.0:2222. Username and password are edi-test.
The visible folder is ~/edi-sftp, outside this repository.
"""

import os
import socket
import sys
import threading

import paramiko
from paramiko import SFTPAttributes, SFTPHandle, SFTPServer
from paramiko.sftp import SFTP_NO_SUCH_FILE, SFTP_OK, SFTP_PERMISSION_DENIED

ROOT = os.path.expanduser("~/edi-sftp")
KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "keys", "server_ecdsa")
HOST = "0.0.0.0"
PORT = 2222
USERNAME = "edi-test"
PASSWORD = "edi-test"


def realpath(path):
    root = os.path.realpath(ROOT)
    relative = (path or ".").lstrip("/").replace("\\", "/")
    full = os.path.realpath(os.path.join(root, relative))
    if os.path.commonpath([root, full]) != root:
        raise PermissionError(path)
    return full


class RootHandle(SFTPHandle):
    def stat(self):
        try:
            return SFTPAttributes.from_stat(os.fstat(self.readfile.fileno() if self.readfile else self.writefile.fileno()))
        except Exception:
            return SFTP_NO_SUCH_FILE


class RootInterface(paramiko.SFTPServerInterface):
    def session_started(self):
        return SFTP_OK

    def session_ended(self):
        return SFTP_OK

    def list_folder(self, path):
        try:
            folder = realpath(path)
        except PermissionError:
            return SFTP_PERMISSION_DENIED
        if not os.path.isdir(folder):
            return SFTP_NO_SUCH_FILE
        entries = []
        for name in sorted(os.listdir(folder)):
            attr = SFTPAttributes.from_stat(os.stat(os.path.join(folder, name)))
            attr.filename = name
            entries.append(attr)
        return entries

    def stat(self, path):
        try:
            full = realpath(path)
        except PermissionError:
            return SFTP_PERMISSION_DENIED
        if not os.path.exists(full):
            return SFTP_NO_SUCH_FILE
        return SFTPAttributes.from_stat(os.stat(full))

    def lstat(self, path):
        return self.stat(path)

    def open(self, path, flags, attr):
        try:
            full = realpath(path)
        except PermissionError:
            return SFTP_PERMISSION_DENIED
        parent = os.path.dirname(full)
        if not os.path.isdir(parent):
            return SFTP_NO_SUCH_FILE
        mode = "rb"
        writing = bool(flags & (os.O_WRONLY | os.O_RDWR))
        if writing:
            if flags & os.O_APPEND:
                mode = "a+b" if flags & os.O_RDWR else "ab"
            elif flags & os.O_RDWR:
                mode = "w+b" if flags & os.O_TRUNC or not os.path.exists(full) else "r+b"
            else:
                mode = "wb"
        try:
            handle = RootHandle(flags)
            opened = open(full, mode)
            if "r" in mode or "+" in mode:
                handle.readfile = opened
            if any(flag in mode for flag in ("w", "a", "+")):
                handle.writefile = opened
            return handle
        except FileNotFoundError:
            return SFTP_NO_SUCH_FILE
        except PermissionError:
            return SFTP_PERMISSION_DENIED

    def remove(self, path):
        try:
            os.remove(realpath(path))
            return SFTP_OK
        except FileNotFoundError:
            return SFTP_NO_SUCH_FILE
        except PermissionError:
            return SFTP_PERMISSION_DENIED

    def rename(self, oldpath, newpath):
        try:
            os.rename(realpath(oldpath), realpath(newpath))
            return SFTP_OK
        except FileNotFoundError:
            return SFTP_NO_SUCH_FILE
        except PermissionError:
            return SFTP_PERMISSION_DENIED

    def mkdir(self, path, attr):
        try:
            os.mkdir(realpath(path))
            return SFTP_OK
        except PermissionError:
            return SFTP_PERMISSION_DENIED

    def rmdir(self, path):
        try:
            os.rmdir(realpath(path))
            return SFTP_OK
        except FileNotFoundError:
            return SFTP_NO_SUCH_FILE
        except PermissionError:
            return SFTP_PERMISSION_DENIED


class Auth(paramiko.ServerInterface):
    def check_auth_password(self, username, password):
        if username == USERNAME and password == PASSWORD:
            return paramiko.AUTH_SUCCESSFUL
        return paramiko.AUTH_FAILED

    def get_allowed_auths(self, username):
        return "password"

    def check_channel_request(self, kind, chanid):
        if kind == "session":
            return paramiko.OPEN_SUCCEEDED
        return paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED


def load_host_key():
    os.makedirs(os.path.dirname(KEY_PATH), exist_ok=True)
    if os.path.exists(KEY_PATH):
        return paramiko.ECDSAKey.from_private_key_file(KEY_PATH)
    key = paramiko.ECDSAKey.generate()
    key.write_private_key_file(KEY_PATH)
    return key


def seed_directories():
    os.makedirs(ROOT, exist_ok=True)


def serve_client(client, host_key):
    transport = paramiko.Transport(client)
    transport.add_server_key(host_key)
    transport.set_subsystem_handler("sftp", SFTPServer, RootInterface)
    try:
        transport.start_server(server=Auth())
    except Exception as exc:
        print(f"handshake failed: {exc}", file=sys.stderr)
        client.close()
        return
    channel = transport.accept(30)
    if channel is None:
        transport.close()
        client.close()
        return
    while transport.is_active():
        transport.join(1)
    client.close()


def main():
    seed_directories()
    host_key = load_host_key()
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind((HOST, PORT))
    listener.listen(8)
    print(f"Mock SFTP listening on {HOST}:{PORT} as {USERNAME}", flush=True)
    print(f"Folder on this machine: {ROOT}", flush=True)
    while True:
        client, _addr = listener.accept()
        threading.Thread(target=serve_client, args=(client, host_key), daemon=True).start()


if __name__ == "__main__":
    main()
