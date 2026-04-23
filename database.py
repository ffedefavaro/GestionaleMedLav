import sqlcipher3
import hashlib
import os

class DatabaseManager:
    def __init__(self, db_path="cartsan.db"):
        self.db_path = db_path
        self.conn = None

    def connect(self, password):
        try:
            self.conn = sqlcipher3.connect(self.db_path)
            self.conn.execute(f"PRAGMA key = '{password}'")
            self.conn.execute("SELECT count(*) FROM sqlite_master")
            return True
        except Exception as e:
            return False

    def initialize_db(self, schema_path="schema.sql"):
        with open(schema_path, 'r') as f:
            schema = f.read()
        self.conn.executescript(schema)
        self.conn.commit()

    def log_action(self, user_id, action, table_name=None, resource_id=None, details=None):
        query = "INSERT INTO audit_logs (user_id, action, table_name, resource_id, details) VALUES (?, ?, ?, ?, ?)"
        self.conn.execute(query, (user_id, action, table_name, resource_id, details))
        self.conn.commit()
