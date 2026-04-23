import sqlcipher3
import hashlib
import os
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

class DatabaseManager:
    def __init__(self, db_path="cartsan.db", vault_path="database.vault"):
        self.db_path = db_path
        self.vault_path = vault_path
        self.conn = None
        self.master_key = None

    def _derive_key(self, password, salt):
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))

    def _get_vault(self):
        if os.path.exists(self.vault_path):
            with open(self.vault_path, 'r') as f:
                return json.load(f)
        return None

    def _save_vault(self, vault_data):
        with open(self.vault_path, 'w') as f:
            json.dump(vault_data, f)

    def is_initialized(self):
        return os.path.exists(self.vault_path)

    def initialize_new_db(self, password, recovery_key):
        # 1. Generate a random master key for SQLCipher
        master_key = base64.urlsafe_b64encode(os.urandom(32)).decode()

        # 2. Setup Vault
        salt_pwd = os.urandom(16)
        salt_recovery = os.urandom(16)

        fernet_pwd = Fernet(self._derive_key(password, salt_pwd))
        wrapped_pwd = fernet_pwd.encrypt(master_key.encode()).decode()

        fernet_recovery = Fernet(self._derive_key(recovery_key, salt_recovery))
        wrapped_recovery = fernet_recovery.encrypt(master_key.encode()).decode()

        vault_data = {
            "salt_pwd": base64.b64encode(salt_pwd).decode(),
            "salt_recovery": base64.b64encode(salt_recovery).decode(),
            "wrapped_pwd": wrapped_pwd,
            "wrapped_recovery": wrapped_recovery
        }
        self._save_vault(vault_data)

        # 3. Connect and initialize schema
        if self.connect(password):
            self.initialize_db()
            return True
        return False

    def connect(self, password):
        vault = self._get_vault()
        if not vault:
            return False

        try:
            salt = base64.b64decode(vault['salt_pwd'])
            fernet = Fernet(self._derive_key(password, salt))
            master_key = fernet.decrypt(vault['wrapped_pwd'].encode()).decode()

            return self._connect_with_master_key(master_key)
        except Exception:
            return False

    def connect_with_recovery(self, recovery_key):
        vault = self._get_vault()
        if not vault:
            return False

        try:
            salt = base64.b64decode(vault['salt_recovery'])
            fernet = Fernet(self._derive_key(recovery_key, salt))
            master_key = fernet.decrypt(vault['wrapped_recovery'].encode()).decode()

            return self._connect_with_master_key(master_key)
        except Exception:
            return False

    def _connect_with_master_key(self, master_key):
        try:
            self.conn = sqlcipher3.connect(self.db_path)
            self.conn.execute(f"PRAGMA key = '{master_key}'")
            # Verify connection
            self.conn.execute("SELECT count(*) FROM sqlite_master")
            self.master_key = master_key
            return True
        except Exception:
            self.conn = None
            return False

    def change_password(self, new_password):
        if not self.master_key:
            return False

        vault = self._get_vault()
        salt_pwd = os.urandom(16)
        fernet_pwd = Fernet(self._derive_key(new_password, salt_pwd))
        wrapped_pwd = fernet_pwd.encrypt(self.master_key.encode()).decode()

        vault['salt_pwd'] = base64.b64encode(salt_pwd).decode()
        vault['wrapped_pwd'] = wrapped_pwd
        self._save_vault(vault)
        return True

    def initialize_db(self, schema_path="schema.sql"):
        if not self.conn:
            return
        with open(schema_path, 'r') as f:
            schema = f.read()
        self.conn.executescript(schema)
        self.conn.commit()

    def log_action(self, user_id, action, table_name=None, resource_id=None, details=None):
        if not self.conn:
            return
        query = "INSERT INTO audit_logs (user_id, action, table_name, resource_id, details) VALUES (?, ?, ?, ?, ?)"
        self.conn.execute(query, (user_id, action, table_name, resource_id, details))
        self.conn.commit()
