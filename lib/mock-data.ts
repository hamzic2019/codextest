import type { Patient, PlanPreview, Shift, Worker } from "@/types";

export const patients: Patient[] = [
  {
    id: "p1",
    name: "Anna Keller",
    city: "Berlin",
    level: "Pflegegrad 4",
    needs: ["Demenz", "Mobilnost uz pomoć", "Noćni monitoring"],
    lastUpdate: "Ažurirano prije 2h",
    tags: ["prioritet", "noćne"],
  },
  {
    id: "p2",
    name: "Erik Hoffmann",
    city: "Hamburg",
    level: "Pflegegrad 3",
    needs: ["Insulin", "24/7", "Sigurnosni alarm"],
    lastUpdate: "Ažurirano jučer",
    tags: ["dnevne"],
  },
  {
    id: "p3",
    name: "Leyla Demir",
    city: "Köln",
    level: "Pflegegrad 2",
    needs: ["Rehab rutina", "Jutarnja njega"],
    lastUpdate: "Ažurirano prije 3 dana",
    tags: ["anerkennung"],
  },
  {
    id: "p4",
    name: "Claudia König",
    city: "München",
    level: "Pflegegrad 5",
    needs: ["Respirator", "24/7", "Spec. prehrana"],
    lastUpdate: "Ažurirano prije 5h",
    tags: ["hitno", "noćne"],
  },
];

export const workers: Worker[] = [
  {
    id: "w1",
    name: "Maja Petrović",
    role: "Gesundheits- und Krankenpflegerin",
    status: "radnik",
    preferredShifts: ["day"],
    hoursPlanned: 128,
    hoursCompleted: 64,
    city: "Berlin",
  },
  {
    id: "w2",
    name: "Johannes Weber",
    role: "Altenpfleger",
    status: "radnik",
    preferredShifts: ["night"],
    hoursPlanned: 140,
    hoursCompleted: 98,
    city: "Hamburg",
  },
  {
    id: "w3",
    name: "Elma Hadžić",
    role: "Pflegefachkraft (Anerkennung)",
    status: "anerkennung",
    preferredShifts: ["day"],
    hoursPlanned: 96,
    hoursCompleted: 48,
    city: "Köln",
  },
  {
    id: "w4",
    name: "Dario Novak",
    role: "Pflegeassistent",
    status: "pocetnik",
    preferredShifts: ["day", "night"],
    hoursPlanned: 72,
    hoursCompleted: 24,
    city: "Berlin",
  },
  {
    id: "w5",
    name: "Sofia Rossi",
    role: "Springer",
    status: "radnik",
    preferredShifts: ["night"],
    hoursPlanned: 120,
    hoursCompleted: 80,
    city: "München",
  },
];

export const shifts: Shift[] = [
  {
    id: "s1",
    patientId: "p1",
    workerId: "w1",
    date: "2025-02-01",
    type: "day",
    start: "07:00",
    end: "19:00",
    note: "Preferira raniji start",
  },
  {
    id: "s2",
    patientId: "p1",
    workerId: "w2",
    date: "2025-02-01",
    type: "night",
    start: "19:00",
    end: "07:00",
    note: "Noćni monitoring",
  },
  {
    id: "s3",
    patientId: "p2",
    workerId: "w3",
    date: "2025-02-02",
    type: "day",
    start: "08:00",
    end: "20:00",
    note: "Anerkennung - nadzor",
  },
  {
    id: "s4",
    patientId: "p3",
    workerId: "w4",
    date: "2025-02-03",
    type: "night",
    start: "19:00",
    end: "07:00",
  },
  {
    id: "s5",
    patientId: "p4",
    workerId: "w5",
    date: "2025-02-04",
    type: "day",
    start: "07:00",
    end: "19:00",
    note: "Respirator provjera",
  },
];

export const planPreviews: PlanPreview[] = [
  {
    patientId: "p1",
    month: "Februar 2025",
    summary:
      "Pokriti 24/7 sa balansom dnevnih i noćnih smjena, uz fokus na kontinuitet (isti tim 2-3 dana za redom).",
    highlights: [
      "Noćne smjene pokrivaju Johannes + Sofia (rotacija na 3 dana)",
      "Dnevne smjene drži Maja, uz Elma kao backup za subotu",
      "Izbjegnuti preklopi sa Erikovim insulin terminima (07:30 / 19:30)",
    ],
  },
  {
    patientId: "p4",
    month: "Februar 2025",
    summary:
      "Respirator zahtijeva bar jednog senior radnika u svakoj smjeni. Dodati checkliste za dolazak/odlazak.",
    highlights: [
      "Sofia preuzima većinu noćnih, uz Dario za shadowing",
      "Dnevne rotiraju Maja i Johannes da pokriju obavezne dokumentacije",
    ],
  },
];
