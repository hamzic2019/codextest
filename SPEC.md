# PflegeKI

Cilj: WebAplikacija koja pomaža vlasnicima Pflegedeinst-a da kreiraju super brzo plan rada za svoje radnike koristeći umjetnu inteligenciju sa fokusom na brzinu i UX.

Glavne funkcije:
- Dodavanje pacijenata i radnika u bazu podataka
- Pregled kalendara za svakog pacijenta u smislu ko od radnika radi dnevnu ili noćnu smjenu kod pacijenta u svakom zadatom danu u mjesecu da je sve to pregledno i lahko prilagodivo u slučaju izmejna.
- Kreiranje uz pomoć ultra filtera dodataka postavki, tesktualnog promta, želja radnika i vlasnika za svakog pacijenta pojedinačno plan u smislu da ima čitava sekcija gdje se moze izabrati pacijent, radnci, preference za radnike hocel nocne dneve, koliko dana, koji radnik ima prioritet tekstualni prompt i jedan magicno dugme koje posalje zahtijev prema OpenAi da openAi kreira najbolji plan prema preferencama a nakon toga da se vrati u obliku vizuelno lijepom layout-u da vlasnik firme sve to pregleda i ako mu se sviđa da primjeni taj plan tj učita za tog pacijenta, također da se prati da nema konflikta tj da OpenAI kreira radni plan tj da planira radnika samo za dana kojeje slobodan tj ako ne radi kod drugog pacijenta ili ako nije bolestan ili godisnjem odmoru.

- Brzo pretraživanje pacijenata i radnika
- Statiske za svakog radnika koliko je planiran sati i koliko je odradio radnih sati, gdje je radio i sve što je važno za Njemačko računovodstvo
- Da ima mogućnost export-a PDF plana po radnik tj da svaki radnik dobji svoj PDF gdje i kod kojeg pacijenta radi taj mjesec ali također da ima PDF  plan po Pacijentu tako da za svakog pacijenta se ima pregled ko radi dnevnu ili nocnu i tako za taj mjesec dana.
- Jako je bitno napomenuti da se kod pacijenta uvijek radi 24 sata dnevno 30 dana u mjesecu ili 31 znači unutar 24 sata uvijek budu dva radnika po 12 sati i inače se počinje ili u 07:00 do 19:00 pa od 19:00 do 07:00 to su dvije dnevne ili noćne smjene, ali treba svakako ostaviti mogućnost prilagođavanja tj da se može pomjeriti vrijeme da bude npr od 08:00 do 20:00 ili od 09:00 do 21:00 itd tj da bude prilagodivo.
- Osim radnika često firme mogu imati nekoga za ANarbeitung tj novog radnika ili radnika koji ima novog pacijenta tao da treba imati oznaku jel radnik, jel početnik jel Anerbeitung itd.

Stranice:
Po mom mišljenju trebalo bi imati Dashboard za pregled svih planovoa u smislu izabere se pacijent i onda izađu sve informacije ko kada radi kalenadr pregledan i sve info o tom pacijentu moze biti dropdown ili searchbar koji izgleda kao real time search u bazi podatak aili eventualno searchbar sa dropdown-om koji ima futuristcki izgled, trebalo bi imati sekuciju pacijenti gdje se ima pregled pacijenata dodavanja brisanje uređivanje dokumentacija itd i tako isto za radnike, eventualno postavke, logo od slova PflegeKI i šta znam za sada je to to, eventualno Customer Support sitnim slovima oje bi kasnije naravno dodali i poravljali.


Stack:
- Next.js (App Router, TypeScript)
- TailwindCSS
- Supabase
- OpenAI API