        {[
          { step: 1, label: 'Selezione' },
          { step: 2, label: 'Anamnesi' },
          { step: 3, label: 'Obiettivo' },
          { step: 4, label: 'Giudizio' }
        ].map((s, idx, arr) => (
          <div key={s.step} className={`flex items-center ${idx < arr.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-2 relative">
              <div className={`flex items-center justify-center w-12 h-12 rounded-2xl border-4 transition-all duration-500 ${
                step >= s.step ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-gray-100 text-gray-300'
              }`}>
                {step > s.step ? <CheckCircle size={22} strokeWidth={3} /> : <span className="font-black">{s.step}</span>}
              </div>
              <span className={`text-[10px] uppercase font-black tracking-widest absolute -bottom-6 whitespace-nowrap ${step >= s.step ? 'text-primary' : 'text-gray-300'}`}>
                {s.label}
              </span>
            </div>
            {idx < arr.length - 1 && (
              <div className={`flex-1 h-1 mx-4 rounded-full transition-colors duration-500 ${step > s.step ? 'bg-primary' : 'bg-gray-100'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="glass-card rounded-[40px] p-10 mt-8 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-primary/5 rounded-2xl"><User size={24} strokeWidth={2.5} /></div>
              <h2 className="text-2xl font-black tracking-tight">Scegli il Lavoratore</h2>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anagrafica Attiva (Ricerca Rapida)</label>
              <WorkerSearch onSelect={setSelectedWorkerId} />
            </div>

            {workerData && (
              <div className="bg-tealAction/5 p-6 rounded-3xl border border-tealAction/10 flex justify-between items-center group hover:bg-tealAction/10 transition-colors">
                <div>
                  <p className="text-tealAction font-black text-lg uppercase tracking-tight">{workerData?.azienda ?? ''}</p>
                  <p className="text-gray-500 font-bold text-sm">Mansione: <span className="text-primary font-black">{workerData?.mansione ?? ''}</span></p>
                </div>
                <div className="flex gap-4">
                  <select
                    className="bg-white border border-gray-100 rounded-xl px-4 font-black text-primary text-sm outline-none focus:ring-2 focus:ring-primary/10"
                    value={visitForm.tipo_visita}
                    onChange={e => setVisitForm({...visitForm, tipo_visita: e.target.value})}
                  >
                    <option value="preventiva">Visita Preventiva</option>
                    <option value="periodica">Visita Periodica</option>
                    <option value="richiesta">Su Richiesta</option>
                    <option value="cambio mansione">Cambio Mansione</option>
                    <option value="rientro">Dopo Assenza &gt;60gg</option>
                  </select>
                  <button onClick={() => setStep(2)} className="btn-teal flex items-center gap-3 px-8">Inizia <RefreshCw size={18} /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-primary">
                <div className="p-3 bg-primary/5 rounded-2xl"><Clipboard size={24} strokeWidth={2.5} /></div>
                <h2 className="text-2xl font-black tracking-tight">Anamnesi</h2>
              </div>
              <div className="bg-warmWhite/50 p-2 px-4 rounded-2xl border border-gray-100 font-black text-primary uppercase text-xs">
                {/* Fix instruction 4 (partially): workerData?.cognome ?? '' */}
                {workerData?.cognome ?? ''} {workerData?.nome ?? ''}
              </div>
            </div>

            <div className="bg-accent/5 border border-accent/10 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-accent font-black flex items-center gap-2 text-sm uppercase tracking-tight">
                  <Mail size={18} /> Acquisizione Gmail
                </h3>
                <button onClick={handleGmailSync} disabled={loadingGmail} className="btn-accent flex items-center gap-2 text-xs py-2 px-4">
                  {loadingGmail ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />} Sincronizza
                </button>
              </div>
              {gmailMessages.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {gmailMessages.map(msg => (
                    <div key={msg.id} className="bg-white/80 p-3 rounded-xl border border-accent/10 text-[10px] flex justify-between items-center gap-4">
                      <div className="flex-1 font-bold">[{msg.date}] {msg.snippet}</div>
                      <button onClick={() => importEmailText(msg)} className="text-accent hover:underline font-black uppercase tracking-tighter shrink-0">Importa</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-12">
              {/* ANAMNESI FAMILIARE */}
              <div className="space-y-6">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Heart size={14} /> Anamnesi Familiare
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visitForm.anamnesi_familiare.map((member, idx) => (
                    <FamilyMemberCard
                      key={member.parentela}
                      member={member}
                      onChange={(updated) => {
                        const newFamiliare = [...visitForm.anamnesi_familiare];
                        newFamiliare[idx] = updated;
                        setVisitForm({ ...visitForm, anamnesi_familiare: newFamiliare });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* ANAMNESI FISIOLOGICA */}
              <div className="space-y-6">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Activity size={14} /> Anamnesi Fisiologica
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-warmWhite/30 p-8 rounded-[32px] border border-gray-100">
                  <div className="space-y-6">
                    {/* FUMO */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Fumo</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Non fumatore', 'Ex fumatore', 'Fumatore'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisitForm({ ...visitForm, anamnesi_patologica: { ...visitForm.anamnesi_patologica, fumo: opt } })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visitForm.anamnesi_patologica.fumo === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      {visitForm.anamnesi_patologica.fumo === 'Fumatore' && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                          <input
                            type="number"
                            placeholder="N° sigarette/die"
                            className="input-standard text-xs py-2 h-10"
                            value={visitForm.anamnesi_patologica.sigarette_die}
                            onChange={(e) => setVisitForm({ ...visitForm, anamnesi_patologica: { ...visitForm.anamnesi_patologica, sigarette_die: e.target.value } })}
                          />
                        </div>
                      )}
                    </div>

                    {/* ALCOL */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Alcol</label>
                      <div className="flex flex-wrap gap-2">
                        {(['No', 'Occasionale', 'Quotidiano'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisitForm({ ...visitForm, anamnesi_patologica: { ...visitForm.anamnesi_patologica, alcol: opt } })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visitForm.anamnesi_patologica.alcol === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ATTIVITA FISICA */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Attività Fisica</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Sedentario', 'Leggera', 'Moderata', 'Intensa'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisitForm({ ...visitForm, anamnesi_patologica: { ...visitForm.anamnesi_patologica, attivita_fisica: opt } })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visitForm.anamnesi_patologica.attivita_fisica === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* LEVA */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Servizio di Leva</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Svolto', 'Non svolto', 'Esonerato'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisitForm({ ...visitForm, servizio_leva: opt })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visitForm.servizio_leva === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SONNO */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Sonno</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Buono', 'Disturbi', 'Insonnia'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisitForm({ ...visitForm, anamnesi_patologica: { ...visitForm.anamnesi_patologica, sonno: opt } })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visitForm.anamnesi_patologica.sonno === opt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* FARMACI */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Farmaci abituali</label>
                      <input
                        type="text"
                        className="input-standard text-xs py-2 h-10"
                        value={visitForm.anamnesi_patologica.farmaci_abituali}
                        onChange={(e) => setVisitForm({ ...visitForm, anamnesi_patologica: { ...visitForm.anamnesi_patologica, farmaci_abituali: e.target.value } })}
                      />
                    </div>

                    {/* ALLERGIE */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Allergie</label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            checked={visitForm.anamnesi_patologica.allergie.nessuna}
                            onChange={(e) => setVisitForm({ ...visitForm, anamnesi_patologica: { ...visitForm.anamnesi_patologica, allergie: { ...visitForm.anamnesi_patologica.allergie, nessuna: e.target.checked, dettaglio: e.target.checked ? '' : visitForm.anamnesi_patologica.allergie.dettaglio } } })}
                          />
                          <span className="text-[10px] font-bold text-gray-600">Nessuna</span>
                        </label>
                        {!visitForm.anamnesi_patologica.allergie.nessuna && (
                          <input
                            type="text"
                            placeholder="Specifica allergie..."
                            className="input-standard text-xs py-2 h-10 flex-1 animate-in fade-in slide-in-from-left-2 duration-300"
                            value={visitForm.anamnesi_patologica.allergie.dettaglio}
                            onChange={(e) => setVisitForm({ ...visitForm, anamnesi_patologica: { ...visitForm.anamnesi_patologica, allergie: { ...visitForm.anamnesi_patologica.allergie, dettaglio: e.target.value } } })}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ANAMNESI PATOLOGICA */}
              <div className="space-y-6">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Stethoscope size={14} /> Anamnesi Patologica
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Patologica Remota (Passata)</label>
                    <textarea
                      className="input-standard h-24 text-xs"
                      placeholder="Interventi, malattie pregresse..."
                      value={visitForm.anamnesi_patologica_remota}
                      onChange={e => setVisitForm({...visitForm, anamnesi_patologica_remota: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Patologica Prossima (Attuale)</label>
                    <textarea
                      className="input-standard h-24 text-xs"
                      placeholder="Sintomi attuali, disturbi recenti..."
                      value={visitForm.anamnesi_patologica_prossima}
                      onChange={e => setVisitForm({...visitForm, anamnesi_patologica_prossima: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Incidenti e Invalidità {/* MODIFICA */}</label>
                    <textarea
                      className="input-standard h-24 text-xs"
                      placeholder="Eventuali incidenti o invalidità..."
                      value={visitForm.incidenti_invalidita}
                      onChange={e => setVisitForm({...visitForm, incidenti_invalidita: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <ShieldCheck size={14} /> Vaccinazioni
                  </label>
                  <textarea
                    className="input-standard h-20 text-xs"
                    placeholder="Antitetanica, Epatite B, etc..."
                    value={visitForm.vaccinazioni}
                    onChange={e => setVisitForm({...visitForm, vaccinazioni: e.target.value})}
                  />
                </div>
              </div>

              {/* ANAMNESI LAVORATIVA */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Briefcase size={14} /> Anamnesi Lavorativa
                  </label>
                  <button
                    onClick={() => {
                      const newExp: WorkExperience = { azienda: '', mansione: '', da: '', a: '', rischi: [] };
                      setVisitForm({ ...visitForm, anamnesi_lavorativa: [...visitForm.anamnesi_lavorativa, newExp] });
                    }}
                    className="btn-teal py-2 px-4 text-[10px] flex items-center gap-2"
                  >
                    <Plus size={14} /> Aggiungi Esperienza
                  </button>
                </div>

                <div className="space-y-4">
                  {visitForm.anamnesi_lavorativa.map((exp, idx) => {
                    const availableRisks: RiskFactor[] = [
                      'Rumore', 'VDT', 'MMC', 'Chimici', 'Polveri',
                      'Biologico', 'Vibrazioni', 'Posture', 'Turni', 'Stress'
                    ];

                    const updateExp = (field: keyof WorkExperience, value: string | RiskFactor[]) => {
                      const newLavorativa = [...visitForm.anamnesi_lavorativa];
                      newLavorativa[idx] = { ...newLavorativa[idx], [field]: value };
                      setVisitForm({ ...visitForm, anamnesi_lavorativa: newLavorativa });
                    };

                    const toggleRisk = (risk: RiskFactor) => {
                      const currentRisks = exp.rischi;
                      const newRisks = currentRisks.includes(risk)
                        ? currentRisks.filter(r => r !== risk)
                        : [...currentRisks, risk];
                      updateExp('rischi', newRisks);
                    };

                    const removeExp = () => {
                      setVisitForm({
                        ...visitForm,
                        anamnesi_lavorativa: visitForm.anamnesi_lavorativa.filter((_, i) => i !== idx)
                      });
                    };

                    return (
                      <div key={idx} className="bg-white border border-gray-100 p-6 rounded-[32px] space-y-4 relative group hover:border-primary/20 transition-all">
                        <button
                          onClick={removeExp}
                          className="absolute top-6 right-6 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-1 space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Azienda</label>
                            <input
                              type="text"
                              className="input-standard h-10 text-xs"
                              value={exp.azienda}
                              onChange={(e) => updateExp('azienda', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-1 space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Mansione</label>
                            <input
                              type="text"
                              className="input-standard h-10 text-xs"
                              value={exp.mansione}
                              onChange={(e) => updateExp('mansione', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Da (anno)</label>
                            <input
                              type="number"
                              className="input-standard h-10 text-xs"
                              placeholder="AAAA"
                              value={exp.da}
                              onChange={(e) => updateExp('da', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">A (anno)</label>
                            <input
                              type="number"
                              className="input-standard h-10 text-xs"
                              placeholder="AAAA"
                              value={exp.a}
                              onChange={(e) => updateExp('a', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Rischi Professionali</label>
                          <div className="flex flex-wrap gap-2">
                            {availableRisks.map(risk => (
                              <button
                                key={risk}
                                onClick={() => toggleRisk(risk)}
                                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${exp.rischi.includes(risk) ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-warmWhite text-gray-400 border border-gray-100 hover:border-accent/20'}`}
                              >
                                {risk}
                              </button>
                            ))}
                          </div>
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
