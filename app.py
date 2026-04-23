import streamlit as st
import pandas as pd
from database import DatabaseManager
import datetime
from pdf_engine import PDFEngine
import os

st.set_page_config(page_title="CartSan Lean", layout="wide")
pdf_engine = PDFEngine()

if 'db' not in st.session_state:
    st.session_state.db = DatabaseManager("cartsan_prod.db")
if 'authenticated' not in st.session_state:
    st.session_state.authenticated = False

def login_ui():
    st.title("🔐 Accesso CartSan Lean")
    password = st.text_input("Inserisci la Master Key del Database", type="password")
    if st.button("Sblocca Database"):
        if st.session_state.db.connect(password):
            st.session_state.db.initialize_db()
            st.session_state.authenticated = True
            st.session_state.db.log_action("admin", "LOGIN")
            st.rerun()
        else:
            st.error("Chiave errata o database corrotto.")

def main_app():
    st.sidebar.title("Menu Principale")
    menu = st.sidebar.radio("Vai a:", ["Dashboard", "Anagrafica Aziende", "Anagrafica Lavoratori", "Nuova Visita", "Scadenziario", "Allegato 3B", "Audit Log"])

    if menu == "Dashboard":
        st.title("🩺 Dashboard Medico del Lavoro")
        st.write("Benvenuto nel tuo sistema gestionale lean.")
        
    elif menu == "Anagrafica Aziende":
        st.title("🏢 Gestione Aziende")
        with st.form("form_azienda"):
            ragione_sociale = st.text_input("Ragione Sociale")
            p_iva = st.text_input("P.IVA / CF")
            indirizzo = st.text_input("Sede Operativa")
            if st.form_submit_button("Salva Azienda"):
                st.session_state.db.conn.execute("INSERT INTO companies (ragione_sociale, p_iva, sede_operativa) VALUES (?, ?, ?)", 
                                              (ragione_sociale, p_iva, indirizzo))
                st.session_state.db.conn.commit()
                st.success("Azienda salvata!")
        
        st.subheader("Elenco Aziende")
        companies = pd.read_sql("SELECT * FROM companies", st.session_state.db.conn)
        st.dataframe(companies)

    elif menu == "Anagrafica Lavoratori":
        st.title("👷 Gestione Lavoratori")
        companies = pd.read_sql("SELECT id, ragione_sociale FROM companies", st.session_state.db.conn)
        if companies.empty:
            st.warning("Inserisci prima un'azienda.")
        else:
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
            
            st.subheader("Elenco Lavoratori")
            workers = pd.read_sql("SELECT workers.*, companies.ragione_sociale FROM workers JOIN companies ON workers.company_id = companies.id", st.session_state.db.conn)
            st.dataframe(workers)

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
        selected_co = st.selectbox("Seleziona Azienda", options=companies['id'], format_func=lambda x: companies[companies['id']==x]['ragione_sociale'].values[0])
        year = st.selectbox("Anno di riferimento", [2024, 2025, 2026])
        if st.button("Genera Excel Allegato 3B"):
            query = f"SELECT workers.codice_fiscale, visits.data_visita, visits.giudizio FROM visits JOIN workers ON visits.worker_id = workers.id WHERE workers.company_id = {selected_co} AND strftime('%Y', visits.data_visita) = '{year}'"
            data_3b = pd.read_sql(query, st.session_state.db.conn)
            excel_name = f"Allegato_3B_{year}.xlsx"
            data_3b.to_excel(excel_name, index=False)
            with open(excel_name, "rb") as f:
                st.download_button("Scarica Excel", f, file_name=excel_name)

    elif menu == "Audit Log":
        st.title("📋 Registro Accessi e Modifiche")
        logs = pd.read_sql("SELECT * FROM audit_logs ORDER BY timestamp DESC", st.session_state.db.conn)
        st.dataframe(logs, use_container_width=True)

if not st.session_state.authenticated:
    login_ui()
else:
    main_app()
