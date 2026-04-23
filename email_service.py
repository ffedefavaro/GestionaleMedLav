import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json
import os

class EmailService:
    def __init__(self, config_path="email_config.json"):
        self.config_path = config_path

    def save_config(self, email, app_password):
        config = {
            "email": email,
            "app_password": app_password
        }
        with open(self.config_path, 'w') as f:
            json.dump(config, f)

    def load_config(self):
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                return json.load(f)
        return None

    def send_recovery_key(self, recovery_key):
        config = self.load_config()
        if not config:
            return False, "Configurazione email mancante."

        sender_email = config['email']
        password = config['app_password']
        receiver_email = sender_email # Invio a se stessi per backup

        message = MIMEMultipart("alternative")
        message["Subject"] = "CartSan Lean - Chiave di Recupero Database"
        message["From"] = sender_email
        message["To"] = receiver_email

        text = f"""
        Ciao,
        Questa è la tua chiave di recupero per il database CartSan Lean.
        Conservala con cura in un luogo sicuro. Ti servirà se dimentichi la tua password principale.

        CHIAVE DI RECUPERO: {recovery_key}

        Se non hai richiesto questa chiave, ignora questa mail.
        """
        html = f"""
        <html>
        <body>
            <h2>CartSan Lean - Backup Sicurezza</h2>
            <p>Questa è la tua <strong>chiave di recupero</strong> per il database CartSan Lean.</p>
            <p>Conservala con cura in un luogo sicuro. Ti servirà se dimentichi la tua password principale.</p>
            <div style="background-color: #f0f0f0; padding: 15px; border: 1px solid #ccc; font-family: monospace; font-size: 1.2em;">
                {recovery_key}
            </div>
            <p><i>Si consiglia di stampare questa mail o salvare la chiave in un password manager.</i></p>
        </body>
        </html>
        """

        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)

        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(sender_email, password)
                server.sendmail(sender_email, receiver_email, message.as_string())
            return True, "Email inviata con successo."
        except Exception as e:
            return False, str(e)
