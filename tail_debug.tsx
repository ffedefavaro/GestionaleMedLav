                        </div>
                      </div>
                    );
                  })}

                  {visitForm.anamnesi_lavorativa.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-[32px] text-gray-300 font-bold uppercase text-[10px] tracking-widest">
                      Nessuna esperienza lavorativa precedente inserita
                    </div>
                  )}

                  {visitForm.anamnesi_lavorativa.length > 0 && (
                    <div className="mt-8 p-8 bg-tealAction/5 rounded-[32px] border border-tealAction/10 space-y-4">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-tealAction" />
                        <span className="text-[10px] font-black text-tealAction uppercase tracking-widest">Riepilogo Esposizioni Cumulative</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                          'Rumore', 'VDT', 'MMC', 'Chimici', 'Polveri',
                          'Biologico', 'Vibrazioni', 'Posture', 'Turni', 'Stress'
                        ].map(risk => {
                          const years = visitForm.anamnesi_lavorativa.reduce((acc, exp) => {
                            if (exp.rischi.includes(risk as RiskFactor)) {
                              const da = parseInt(exp.da);
                              const a = parseInt(exp.a) || new Date().getFullYear();
                              if (!isNaN(da)) {
                                return acc + (Math.max(1, a - da));
                              }
                            }
                            return acc;
                          }, 0);

                          if (years === 0) return null;

                          return (
                            <div key={risk} className="bg-white p-3 rounded-2xl border border-tealAction/10 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] font-black text-primary uppercase leading-tight">{risk}</span>
                              <span className="text-lg font-black text-tealAction">{years} <span className="text-[8px] uppercase">Anni</span></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(1)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Indietro</button>
              <button onClick={() => setStep(3)} className="btn-teal px-12 py-4">Prossimo Step</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-primary/5 rounded-2xl"><Activity size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Parametri e Esame Obiettivo</h2>
            </div>

            {/* Vital Signs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Heart size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Sistolica</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.p_sistolica} onChange={e => setVisitForm({...visitForm, p_sistolica: e.target.value ? parseInt(e.target.value) : ''})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">mmHg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Heart size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Diastolica</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.p_diastolica} onChange={e => setVisitForm({...visitForm, p_diastolica: e.target.value ? parseInt(e.target.value) : ''})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">mmHg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-tealAction/40"><Activity size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Frequenza</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-tealAction outline-none" value={visitForm.frequenza} onChange={e => setVisitForm({...visitForm, frequenza: e.target.value ? parseInt(e.target.value) : ''})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">bpm</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-accent/40"><Weight size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Peso</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-accent outline-none" value={visitForm.peso} onChange={e => setVisitForm({...visitForm, peso: e.target.value ? parseFloat(e.target.value) : ''})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">kg</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-accent/40"><Ruler size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Altezza</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-accent outline-none" value={visitForm.altezza} onChange={e => setVisitForm({...visitForm, altezza: e.target.value ? parseInt(e.target.value) : ''})} />
                <span className="text-[8px] font-bold text-gray-400 uppercase">cm</span>
              </div>
              <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 flex flex-col justify-center items-center gap-1">
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">BMI</span>
                <span className="text-2xl font-black text-primary">{calculateBMI()}</span>
              </div>
              <div className="bg-warmWhite p-4 rounded-3xl border border-gray-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary/40"><Wind size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">SpO2 %</span></div>
                <input type="number" className="bg-transparent font-black text-xl text-primary outline-none" value={visitForm.spo2} onChange={e => setVisitForm({...visitForm, spo2: e.target.value ? parseInt(e.target.value) : ''})} />
              </div>
            </div>

            {/* Structured EO Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                {[
                  { id: 'eo_cardiaca', label: 'Apparato Cardiovascolare', icon: <Heart size={16} /> },
                  { id: 'eo_respiratoria', label: 'Apparato Respiratorio', icon: <Wind size={16} /> },
                  { id: 'eo_cervicale', label: 'Rachide Cervicale', icon: <Stethoscope size={16} /> },
                  { id: 'eo_dorsolombare', label: 'Rachide Dorsolombare', icon: <Stethoscope size={16} /> },
                ].map(field => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      {field.icon} {field.label}
                    </label>
                    <textarea
                      className="input-standard h-20 text-sm"
                      placeholder="Note o 'Regolare'..."
                      value={visitForm[field.id as EOFieldName]}
                      onChange={e => setVisitForm({...visitForm, [field.id]: e.target.value})}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-6">
                {[
                  { id: 'eo_spalle', label: 'Spalle', icon: <Stethoscope size={16} /> },
                  { id: 'eo_arti_superiori', label: 'Arti Superiori (Gomiti, Polsi, Mani)', icon: <Stethoscope size={16} /> },
                  { id: 'eo_arti_inferiori', label: 'Arti Inferiori', icon: <Stethoscope size={16} /> },
                  { id: 'eo_altro', label: 'Altro / Accertamenti Strumentali', icon: <Activity size={16} /> },
                ].map(field => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      {field.icon} {field.label}
                    </label>
                    <textarea
                      className="input-standard h-20 text-sm"
                      placeholder="Note o 'Regolare'..."
                      value={visitForm[field.id as EOFieldName]}
                      onChange={e => setVisitForm({...visitForm, [field.id]: e.target.value})}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Indietro</button>
              <button onClick={() => setStep(4)} className="btn-teal px-12 py-4">Vai al Giudizio</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-accent/5 rounded-2xl text-accent"><CheckCircle size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Giudizio Finale</h2>
            </div>

            <div className="bg-accent/5 p-8 rounded-[40px] border border-accent/10 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Giudizio di Idoneità</label>
                <select className="input-standard font-black text-primary" value={visitForm.giudizio} onChange={e => setVisitForm({...visitForm, giudizio: e.target.value})}>
                  <option value="idoneo">IDONEO</option>
                  <option value="idoneo con prescrizioni">IDONEO CON PRESCRIZIONI</option>
                  <option value="idoneo con limitazioni">IDONEO CON LIMITAZIONI</option>
                  <option value="non idoneo temporaneo">NON IDONEO TEMPORANEO</option>
                  <option value="non idoneo permanente">NON IDONEO PERMANENTE</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prossima Visita</label>
                <input type="date" className="input-standard font-black text-primary" value={visitForm.scadenza_prossima} onChange={e => setVisitForm({...visitForm, scadenza_prossima: e.target.value})} />
              </div>
              <div className="col-span-full flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Conclusioni {/* MODIFICA */}</label>
                <textarea className="input-standard h-20" value={visitForm.conclusioni} onChange={e => setVisitForm({...visitForm, conclusioni: e.target.value})} />
              </div>
              <div className="col-span-full flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prescrizioni / Note</label>
                <textarea className="input-standard h-32" value={visitForm.prescrizioni} onChange={e => setVisitForm({...visitForm, prescrizioni: e.target.value})} />
              </div>
            </div>

            <div className="flex justify-between mt-10 pt-8 border-t border-gray-50">
              <button onClick={() => setStep(3)} className="px-6 py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Indietro</button>
              <div className="flex gap-4">
                 <a
                  // Fix instruction 4 (partially): workerData?.cognome ?? ''
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Visita+Medica:+${workerData?.cognome ?? ''}+${workerData?.nome ?? ''}&dates=${visitForm.scadenza_prossima.replace(/-/g, '')}T090000Z/${visitForm.scadenza_prossima.replace(/-/g, '')}T100000Z&details=Prossima+visita+programmata&sf=true&output=xml`}
                  target="_blank" rel="noopener noreferrer" className="btn-teal px-6 py-5"><RefreshCw size={22} /></a>
                 <button onClick={handleSave} className="btn-accent px-12 py-5 flex items-center gap-3 shadow-2xl shadow-accent/20"><Download size={22} strokeWidth={3} /> Salva e Stampa</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NuovaVisita;
