import streamlit as st
import pandas as pd
from database import DatabaseManager
from email_service import EmailService
import datetime
from pdf_engine import PDFEngine
import os
import secrets
import string

st.set_page_config(page_title="CartSan Lean", layout="wide")
pdf_engine = PDFEngine()
email_service = EmailService()

if 'db' not in st.session_state:
    st.session_state.db = DatabaseManager("cartsan_prod.db")
if 'authenticated' not in st.session_state:
    st.session_state.authenticated = False

def generate_recovery_key():
    return '-'.join(''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4)) for _ in range(4))

def setup_ui():
    st.title("🛡️ Configurazione Iniziale Sicurezza")
    st.info("Benvenuto! Poiché è il primo avvio, dobbiamo configurare l'accesso sicuro al tuo database.")

    with st.form("setup_form"):
        st.subheader("1. Imposta Password Principale")
        new_pwd = st.text_input("Scegli una Password Robusta", type="password")
        confirm_pwd = st.text_input("Conferma Password", type="password")

        st.subheader("2. Configura Recupero via Gmail")
        st.write("Inserisci i dati del tuo account Gmail per ricevere la chiave di recupero.")
        gmail_user = st.text_input("Indirizzo Gmail", placeholder="esempio@gmail.com")
        gmail_app_pwd = st.text_input("Password per le App di Google", type="password", help="Genera una 'Password per le App' nelle impostazioni del tuo account Google.")

        submit = st.form_submit_button("Inizializza Sistema")

        if submit:
            if not new_pwd or new_pwd != confirm_pwd:
                st.error("Le password non coincidono o sono vuote.")
            elif not gmail_user or not gmail_app_pwd:
                st.error("Dati Gmail mancanti.")
            else:
                recovery_key = generate_recovery_key()
                email_service.save_config(gmail_user, gmail_app_pwd)

                with st.spinner("Invio chiave di recupero via mail..."):
                    success, msg = email_service.send_recovery_key(recovery_key)
                    if success:
                        if st.session_state.db.initialize_new_db(new_pwd, recovery_key):
                            st.success("Configurazione completata! La chiave di recupero è stata inviata alla tua mail.")
                            st.session_state.db.log_action("system", "INITIALIZE_DB")
                            st.balloons()
                            if st.button("Vai al Login"):
                                st.rerun()
                        else:
                            st.error("Errore durante l'inizializzazione del database.")
                    else:
                        st.error(f"Errore invio mail: {msg}. Verifica i dati Gmail e riprova.")

def login_ui():
    st.title("🔐 Accesso CartSan Lean")

    tab_login, tab_recovery = st.tabs(["Login Standard", "Recupero Database"])

    with tab_login:
        password = st.text_input("Password", type="password", key="login_pwd")
        if st.button("Accedi"):
            if st.session_state.db.connect(password):
                st.session_state.authenticated = True
                st.session_state.db.log_action("admin", "LOGIN")
                st.rerun()
            else:
                st.error("Password errata.")

    with tab_recovery:
        st.warning("Usa la chiave di recupero inviata via mail se hai perso la password.")
        recovery_key = st.text_input("Inserisci Chiave di Recupero", key="recovery_key")
        if st.button("Sblocca con Chiave"):
            if st.session_state.db.connect_with_recovery(recovery_key):
                st.session_state.authenticated = True
                st.session_state.db.log_action("admin", "RECOVERY_LOGIN")
                st.success("Database sbloccato con successo! Vai nelle impostazioni per cambiare la password.")
                st.rerun()
            else:
                st.error("Chiave di recupero non valida.")

def main_app():
    st.sidebar.title("Menu Principale")
    menu = st.sidebar.radio("Vai a:", ["Dashboard", "Anagrafica Aziende", "Anagrafica Lavoratori", "Nuova Visita", "Scadenziario", "Allegato 3B", "Audit Log", "Impostazioni"])

    if menu == "Dashboard":
        st.title("🩺 Dashboard Medico del Lavoro")
        # Quick stats
        col1, col2, col3 = st.columns(3)
        try:
            n_aziende = pd.read_sql("SELECT count(*) FROM companies", st.session_state.db.conn).iloc[0,0]
            n_lavoratori = pd.read_sql("SELECT count(*) FROM workers", st.session_state.db.conn).iloc[0,0]
            n_visite = pd.read_sql("SELECT count(*) FROM visits", st.session_state.db.conn).iloc[0,0]
            col1.metric("Aziende", n_aziende)
            col2.metric("Lavoratori", n_lavoratori)
            col3.metric("Visite Totali", n_visite)
        except:
            pass
        
        st.write("---")
        st.subheader("Visite in scadenza (prossimi 30 giorni)")
        query = "SELECT workers.nome, workers.cognome, companies.ragione_sociale, visits.data_scadenza FROM visits JOIN workers ON visits.worker_id = workers.id JOIN companies ON workers.company_id = companies.id WHERE visits.data_scadenza BETWEEN date('now') AND date('now', '+30 days') ORDER BY visits.data_scadenza ASC"
        expiring = pd.read_sql(query, st.session_state.db.conn)
        if expiring.empty:
            st.info("Nessuna visita in scadenza a breve.")
        else:
            st.dataframe(expiring, use_container_width=True)

    elif menu == "Anagrafica Aziende":
        st.title("🏢 Gestione Aziende")
        with st.expander("➕ Aggiungi Nuova Azienda"):
            with st.form("form_azienda"):
                ragione_sociale = st.text_input("Ragione Sociale")
                p_iva = st.text_input("P.IVA / CF")
                indirizzo = st.text_input("Sede Operativa")
                if st.form_submit_button("Salva Azienda"):
                    st.session_state.db.conn.execute("INSERT INTO companies (ragione_sociale, p_iva, sede_operativa) VALUES (?, ?, ?)",
                                                  (ragione_sociale, p_iva, indirizzo))
                    st.session_state.db.conn.commit()
                    st.success("Azienda salvata!")
                    st.rerun()
        
        st.subheader("Elenco Aziende")
        companies = pd.read_sql("SELECT * FROM companies", st.session_state.db.conn)
        st.dataframe(companies, use_container_width=True)

    elif menu == "Anagrafica Lavoratori":
        st.title("👷 Gestione Lavoratori")
        companies = pd.read_sql("SELECT id, ragione_sociale FROM companies", st.session_state.db.conn)
        if companies.empty:
            st.warning("Inserisci prima un'azienda.")
        else:
            with st.expander("➕ Aggiungi Nuovo Lavoratore"):
                with st.form("form_lavoratore"):
                    company_id = st.selectbox("Azienda", options=companies['id'], format_func=lambda x: companies[companies['id']==x]['ragione_sociale'].values[0])
                    nome = st.text_input("Nome")
                    cognome = st.text_input("Cognome")
                    cf = st.text_input("Codice Fiscale")
                    mansione = st.text_input("Mansione")
                    if st.form_submit_button("Salva Lavoratore"):
                        st.session_state.db.conn.execute("INSERT INTO workers (company_id, nome, cognome, codice_fiscale, mansione) VALUES (?, ?, ?, ?, ?)",
                                                      (company_id, nome, cognome, cf, mansione))
                        st.session_state.db.conn.commit()
                        st.success("Lavoratore salvato!")
                        st.rerun()
            
            st.subheader("Elenco Lavoratori")
            workers = pd.read_sql("SELECT workers.*, companies.ragione_sociale FROM workers JOIN companies ON workers.company_id = companies.id", st.session_state.db.conn)
            st.dataframe(workers, use_container_width=True)

    elif menu == "Nuova Visita":
        st.title("📝 Esecuzione Visita Medica")
        workers = pd.read_sql("SELECT workers.id, nome, cognome, nome || ' ' || cognome as full_name, companies.ragione_sociale as azienda, mansione FROM workers JOIN companies ON workers.company_id = companies.id", st.session_state.db.conn)
        if workers.empty:
            st.warning("Inserisci prima dei lavoratori in anagrafica.")
            return
        worker_id = st.selectbox("Seleziona Lavoratore", options=workers['id'], format_func=lambda x: workers[workers['id']==x]['full_name'].values[0])
        
        tab1, tab2, tab3, tab4 = st.tabs(["1. Biometria", "2. Anamnesi", "3. Esame Obiettivo", "4. Strumentali & Giudizio"])
        with tab1:
            st.subheader("Parametri Biometrici")
            peso = st.number_input("Peso (kg)", 0.0, 300.0, 70.0)
            altezza = st.number_input("Altezza (cm)", 50, 250, 170)
            bmi = peso / ((altezza/100)**2)
            st.metric("BMI", round(bmi, 2))
            p_sist = st.number_input("Pressione Sistolica", 50, 250, 120)
            p_diast = st.number_input("Pressione Diastolica", 30, 150, 80)
            fc = st.number_input("Frequenza Cardiaca", 30, 200, 70)

        with tab2:
            st.info("Sezione Anamnesi in sviluppo - I dati inseriti qui non vengono ancora salvati permanentemente.")
            anamnesi_lav = st.text_area("Anamnesi Lavorativa (esposizione rischi passati)")
            anamnesi_fam = st.text_area("Anamnesi Familiare")
            anamnesi_rem = st.text_area("Anamnesi Remota (patologie pregresse)")
            anamnesi_pro = st.text_area("Anamnesi Prossima")

        with tab4:
            st.subheader("Esami Strumentali e Giudizio")
            giudizio = st.selectbox("Giudizio di Idoneità", ["Idoneo", "Idoneo con prescrizioni", "Idoneo con limitazioni", "Temporaneamente non idoneo", "Inidoneo"])
            scadenza = st.date_input("Scadenza prossima visita", datetime.date.today() + datetime.timedelta(days=365))
            if st.button("Finalizza Visita e Salva"):
                cur = st.session_state.db.conn.cursor()
                cur.execute("INSERT INTO visits (worker_id, data_visita, data_scadenza, giudizio) VALUES (?, ?, ?, ?)",
                            (worker_id, datetime.date.today(), scadenza, giudizio))
                v_id = cur.lastrowid
                cur.execute("INSERT INTO biometrics (visit_id, peso, altezza, bmi, pressione_sistolica, pressione_diastolica, frequenza_cardiaca) VALUES (?,?,?,?,?,?,?)",
                            (v_id, peso, altezza, bmi, p_sist, p_diast, fc))
                st.session_state.db.conn.commit()
                st.session_state.db.log_action("admin", "INSERT", "visits", v_id)
                st.success(f"Visita salvata con ID: {v_id}")

                worker_data = workers[workers['id'] == worker_id].iloc[0]
                pdf_data = {'nome': worker_data['nome'], 'cognome': worker_data['cognome'], 'azienda': worker_data['azienda'], 'mansione': worker_data['mansione'], 'giudizio': giudizio, 'scadenza': scadenza.strftime("%d/%m/%Y")}
                output_pdf = f"giudizio_{worker_id}_{v_id}.pdf"
                pdf_engine.fill_giudizio(pdf_data, output_pdf)
                with open(output_pdf, "rb") as f:
                    st.download_button("Scarica Giudizio di Idoneità PDF", f, file_name=output_pdf)

    elif menu == "Scadenziario":
        st.title("📅 Scadenziario Visite")
        query = "SELECT workers.nome, workers.cognome, companies.ragione_sociale, visits.data_scadenza, visits.giudizio FROM visits JOIN workers ON visits.worker_id = workers.id JOIN companies ON workers.company_id = companies.id WHERE visits.data_scadenza >= date('now') ORDER BY visits.data_scadenza ASC"
        schedule = pd.read_sql(query, st.session_state.db.conn)
        st.dataframe(schedule, use_container_width=True)

    elif menu == "Allegato 3B":
        st.title("📊 Esportazione Allegato 3B (INAIL)")
        companies = pd.read_sql("SELECT id, ragione_sociale FROM companies", st.session_state.db.conn)
        if not companies.empty:
            selected_co = st.selectbox("Seleziona Azienda", options=companies['id'], format_func=lambda x: companies[companies['id']==x]['ragione_sociale'].values[0])
            year = st.selectbox("Anno di riferimento", [2024, 2025, 2026])
            if st.button("Genera Excel Allegato 3B"):
                query = f"SELECT workers.codice_fiscale, visits.data_visita, visits.giudizio FROM visits JOIN workers ON visits.worker_id = workers.id WHERE workers.company_id = {selected_co} AND strftime('%Y', visits.data_visita) = '{year}'"
                data_3b = pd.read_sql(query, st.session_state.db.conn)
                excel_name = f"Allegato_3B_{year}.xlsx"
                data_3b.to_excel(excel_name, index=False)
                with open(excel_name, "rb") as f:
                    st.download_button("Scarica Excel", f, file_name=excel_name)
        else:
            st.warning("Nessuna azienda presente.")

    elif menu == "Audit Log":
        st.title("📋 Registro Accessi e Modifiche")
        logs = pd.read_sql("SELECT * FROM audit_logs ORDER BY timestamp DESC", st.session_state.db.conn)
        st.dataframe(logs, use_container_width=True)

    elif menu == "Impostazioni":
        st.title("⚙️ Impostazioni")

        st.subheader("Cambia Password Database")
        with st.form("change_pwd_form"):
            new_p = st.text_input("Nuova Password", type="password")
            conf_p = st.text_input("Conferma Nuova Password", type="password")
            if st.form_submit_button("Aggiorna Password"):
                if new_p and new_p == conf_p:
                    if st.session_state.db.change_password(new_p):
                        st.success("Password aggiornata correttamente!")
                    else:
                        st.error("Errore durante l'aggiornamento.")
                else:
                    st.error("Le password non coincidono.")

        st.subheader("Configurazione Gmail")
        current_config = email_service.load_config()
        with st.form("gmail_config_form"):
            new_mail = st.text_input("Email Gmail", value=current_config['email'] if current_config else "")
            new_app_pwd = st.text_input("Nuova Password per le App", type="password")
            if st.form_submit_button("Aggiorna Configurazione Gmail"):
                email_service.save_config(new_mail, new_app_pwd if new_app_pwd else current_config['app_password'])
                st.success("Configurazione Gmail salvata!")

if not st.session_state.db.is_initialized():
    setup_ui()
elif not st.session_state.authenticated:
    login_ui()
else:
    main_app()
