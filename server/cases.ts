export type MysteryCase = {
  title: string;
  category: string;
  difficulty: string;
  publicStory: string;
  solution: string;
  frames: string[];
  hints: { text: string; competitivePenalty: number; partyPenalty: number }[];
};

export const MYSTERY_CASES: MysteryCase[] = [
  {
    title: 'POSTO 17A', category: 'MIND', difficulty: 'MEDIO',
    publicStory: 'Un uomo sale su un aereo felicissimo. Quando vede chi è seduto al posto 17A, scende immediatamente. Perché?',
    solution: 'L’uomo riconosce nel passeggero del 17A una persona che credeva morta nell’incidente del volo 171, un trauma mai elaborato. Capisce che qualcuno gli ha mentito e, travolto dal panico e dal dubbio, abbandona l’aereo.',
    frames: ['Conosceva già la persona al posto 17A', 'Credeva che quella persona fosse morta', 'La morte era collegata al volo 171', 'Vederla viva gli rivela una menzogna'],
    hints: [
      { text: 'Il numero 17 richiama un trauma preciso.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Il passeggero del 17A non è uno sconosciuto.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'L’uomo era convinto che quella persona non fosse più viva.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'Il volo 171 e una falsa notizia di morte collegano tutto.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'L’ULTIMA FOTO', category: 'DARK', difficulty: 'MEDIO',
    publicStory: 'Una donna fotografa ogni giorno la stessa finestra. Una sera cancella tutte le foto e chiama la polizia.',
    solution: 'Nelle immagini documentava involontariamente la routine del vicino. Confrontandole vede una figura immobile dietro la tenda per giorni: il vicino è morto e qualcuno continua ad accendere la luce per fingere che sia vivo.',
    frames: ['Le foto formavano una sequenza nel tempo', 'Il vicino era morto', 'Qualcuno simulava la sua presenza', 'La luce accesa era parte dell’inganno'],
    hints: [
      { text: 'Conta ciò che cambia — e ciò che non cambia — tra le foto.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'La finestra appartiene a un’altra persona.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'Una sagoma resta nella stessa posizione troppo a lungo.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'Qualcuno accende la luce per nascondere una morte.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'IL CAFFÈ FREDDO', category: 'CRIME', difficulty: 'FACILE',
    publicStory: 'Un barista serve un caffè freddo a un cliente abituale. Il cliente sorride, paga e corre fuori senza berlo.',
    solution: 'Il caffè freddo è un segnale concordato: indica che la persona che lo perseguita è entrata nel locale. Il barista lo avverte senza parlare e il cliente fugge dall’uscita sul retro.',
    frames: ['Il caffè era un messaggio in codice', 'Il cliente era in pericolo', 'Il barista voleva avvertirlo', 'Nel locale era entrata la persona pericolosa'],
    hints: [
      { text: 'La temperatura non è un errore.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Barista e cliente hanno un accordo.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'Il segnale riguarda qualcuno appena entrato.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'È un allarme silenzioso contro uno stalker.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'TRE MINUTI', category: 'SOCIAL', difficulty: 'DIFFICILE',
    publicStory: 'Ogni mattina un uomo arriva al lavoro con tre minuti di ritardo. Il giorno in cui è puntuale viene licenziato.',
    solution: 'Lavora come collaudatore di un sistema ferroviario e sincronizza il tragitto con un orologio pubblico notoriamente avanti di tre minuti. Arrivare “puntuale” dimostra che quel giorno non ha eseguito il controllo di sicurezza concordato.',
    frames: ['Il ritardo era intenzionale', 'Un orologio segnava un’ora sbagliata', 'Il suo lavoro riguardava la sicurezza', 'La puntualità provava che aveva saltato un controllo'],
    hints: [
      { text: 'I tre minuti sono sempre esatti.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Esiste un secondo orologio.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'Il ritardo dimostra che compie un’azione.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'Essere puntuale rivela un controllo di sicurezza saltato.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'LA PORTA APERTA', category: 'RELATIONSHIP', difficulty: 'MEDIO',
    publicStory: 'Una ragazza trova la porta di casa aperta. Non entra, lascia le chiavi a terra e se ne va per sempre.',
    solution: 'La porta poteva essere aperta solo dall’interno perché la serratura era guasta. La ragazza viveva sola, ma aveva dato per anni rifugio segreto alla sorella scomparsa. La porta aperta significa che la sorella è tornata e vuole essere trovata da qualcun altro.',
    frames: ['La serratura si apriva solo dall’interno', 'La ragazza non viveva davvero sola', 'La sorella scomparsa era nascosta lì', 'Lasciare le chiavi era una scelta di protezione'],
    hints: [
      { text: 'La serratura ha una particolarità.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Qualcuno che non dovrebbe esserci è dentro.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'La ragazza protegge una persona scomparsa.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'La sorella è tornata e la porta è un addio concordato.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'NESSUN MESSAGGIO', category: 'ONLINE', difficulty: 'MEDIO',
    publicStory: 'Per un anno un ragazzo riceve un messaggio vuoto ogni domenica. La prima domenica senza messaggio festeggia.',
    solution: 'Il padre disperso aveva programmato messaggi automatici come prova di vita: ogni settimana li annullava manualmente. Il messaggio vuoto significava che era ancora prigioniero. La sua assenza indica che finalmente ha disattivato il sistema dopo essere stato liberato.',
    frames: ['I messaggi erano programmati', 'Qualcuno li annullava quando era al sicuro', 'Il mittente era tenuto prigioniero', 'L’assenza del messaggio indicava la liberazione'],
    hints: [
      { text: 'Il messaggio non veniva scritto ogni domenica.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Il vuoto era una prova di vita.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'Il mittente non era libero.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'Da libero poteva finalmente disattivare l’invio automatico.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'APPLAUSI AL BUIO', category: 'ASSURDO', difficulty: 'FACILE',
    publicStory: 'In un teatro, il pubblico applaude soltanto quando tutte le luci si spengono. L’attore è felicissimo.',
    solution: 'L’attore è un tecnico delle ombre che ha promesso di ottenere un buio totale per un raro esperimento astronomico proiettato dal vivo. Lo spegnimento completo dimostra che ha risolto il difetto luminoso che rovinava lo spettacolo.',
    frames: ['Il buio era l’obiettivo dello spettacolo', 'L’attore era anche responsabile tecnico', 'Una luce difettosa impediva la riuscita', 'L’applauso celebrava la soluzione tecnica'],
    hints: [
      { text: 'Non stanno applaudendo una battuta.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Il buio totale è necessario.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'L’attore controlla anche le luci.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'Ha appena risolto il guasto che impediva l’esperimento.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'IL PACCO VUOTO', category: 'CRIME', difficulty: 'DIFFICILE',
    publicStory: 'Un corriere consegna un pacco vuoto. Il destinatario lo ringrazia e lo nasconde immediatamente nel freezer.',
    solution: 'Il pacco contiene in realtà aria prelevata da una stanza contaminata. Il destinatario è un investigatore: conservarlo al freddo preserva le tracce volatili che proveranno l’avvelenamento.',
    frames: ['Il contenuto invisibile era l’aria', 'L’aria proveniva da una scena sospetta', 'Il destinatario cercava una prova', 'Il freddo preservava sostanze volatili'],
    hints: [
      { text: 'Vuoto non significa privo di contenuto.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Dentro c’è qualcosa di invisibile.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'Il freezer serve a conservare una prova.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'È un campione d’aria contaminata.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'IL MATRIMONIO MUTO', category: 'RELATIONSHIP', difficulty: 'MEDIO',
    publicStory: 'Durante un matrimonio nessuno pronuncia il nome della sposa. Alla fine lei abbraccia tutti, commossa.',
    solution: 'La sposa ha appena completato una transizione e ha scelto il nuovo nome come sorpresa da rivelare durante la cerimonia. Gli invitati evitano entrambi i nomi per non rovinarla; il silenzio è rispetto, non rifiuto.',
    frames: ['Il nome corretto doveva essere una sorpresa', 'La sposa aveva cambiato identità pubblica', 'Gli invitati conoscevano il segreto', 'Il silenzio era una forma di rispetto'],
    hints: [
      { text: 'Nessuno vuole ferire la sposa.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Usare un nome rovinerebbe una sorpresa.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'Esistono un vecchio e un nuovo nome.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'Il nuovo nome sarà annunciato dalla sposa stessa.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'ASCENSORE 0', category: 'PARANORMAL', difficulty: 'DIFFICILE',
    publicStory: 'Un ascensore ha solo i tasti dall’1 al 20. Ogni notte si ferma al piano 0 e apre le porte.',
    solution: 'Il palazzo è stato costruito sopra una vecchia stazione. Il software usa ancora lo zero come piano di manutenzione, raggiungibile soltanto durante il ciclo automatico notturno. Le porte si aprono sul tunnel tecnico, non su un piano fantasma.',
    frames: ['Esiste un livello sotterraneo non indicato', 'Il piano 0 è tecnico', 'Il software esegue un ciclo automatico', 'Il palazzo ingloba una vecchia stazione'],
    hints: [
      { text: 'Non è un fenomeno soprannaturale.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Il piano esiste ma non è per il pubblico.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'La fermata fa parte della manutenzione.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'Dietro le porte c’è un vecchio tunnel ferroviario.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'LA TORTA INTATTA', category: 'TRASH', difficulty: 'FACILE',
    publicStory: 'A una festa tutti mangiano la torta, ma a fine serata è ancora perfettamente intatta.',
    solution: 'La torta esposta è una scenografia di plastica usata per le foto. La vera torta, già tagliata in cucina, viene servita a fette senza mai portare in sala l’originale.',
    frames: ['La torta esposta non era commestibile', 'La vera torta era in cucina', 'Le fette venivano servite separatamente', 'La torta intatta serviva per le fotografie'],
    hints: [
      { text: 'Ci sono due “torte”.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Quella visibile serve all’immagine della festa.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'Le fette arrivano già tagliate.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'La torta esposta è una scenografia.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
  {
    title: 'IL CANE CHE NON ABBAIA', category: 'CRIME', difficulty: 'ESTREMO',
    publicStory: 'Ogni notte un cane abbaia al postino. La notte del furto resta in silenzio, e questo scagiona il postino.',
    solution: 'Il cane abbaia al suono metallico del carrello, non alla persona. La notte del furto qualcuno imita la divisa del postino ma arriva a piedi. Il silenzio prova che mancava il carrello e quindi che non era il vero postino.',
    frames: ['Il cane reagiva a un suono', 'Il suono proveniva dal carrello', 'Il ladro indossava una divisa', 'Il ladro era arrivato a piedi'],
    hints: [
      { text: 'Il cane non riconosce necessariamente i volti.', competitivePenalty: 10, partyPenalty: 10 },
      { text: 'Reagisce a qualcosa che accompagna il postino.', competitivePenalty: 20, partyPenalty: 20 },
      { text: 'Il ladro ha copiato l’aspetto, non il rumore.', competitivePenalty: 40, partyPenalty: 30 },
      { text: 'Mancava il tintinnio del carrello postale.', competitivePenalty: 70, partyPenalty: 40 },
    ],
  },
];

export function getCasesForSettings(settings: { categories?: string[]; difficulties?: string[] }) {
  const categories = settings.categories?.length ? settings.categories : ['MIX'];
  const difficulties = settings.difficulties?.length ? settings.difficulties : ['MIX'];
  return MYSTERY_CASES.filter((mystery) =>
    (categories.includes('MIX') || categories.includes(mystery.category)) &&
    (difficulties.includes('MIX') || difficulties.includes(mystery.difficulty)),
  );
}

export function getCaseForRound(roundNumber: number, settings: { categories?: string[]; difficulties?: string[] } = {}) {
  const pool = getCasesForSettings(settings);
  return pool[roundNumber % pool.length] ?? MYSTERY_CASES[roundNumber % MYSTERY_CASES.length];
}
