// ==========================================================
// FRIENDS ZONE — REAL-DATA CHECKS
// Used by the Create Account page, the Sign In page and the
// edit-profile forms on the homepage.
//
// Note: these checks run in the browser. They stop honest
// mistakes and casual junk (like "Nothing" or 0000000000),
// but a technical person can bypass any browser check. The
// only way to prove an email is real is the verification
// email that is sent when the account is created.
// ==========================================================

// Change this if you set a different minimum age in your Terms.
export const MIN_AGE = 13;
export const MAX_AGE = 100;

// ---------------------------------------------------------
// COUNTRIES  [ISO code, name, phone code]
// ---------------------------------------------------------
const RAW_COUNTRIES = [
  ["AF","Afghanistan","+93"],["AL","Albania","+355"],["DZ","Algeria","+213"],
  ["AD","Andorra","+376"],["AO","Angola","+244"],["AG","Antigua and Barbuda","+1"],
  ["AR","Argentina","+54"],["AM","Armenia","+374"],["AW","Aruba","+297"],
  ["AU","Australia","+61"],["AT","Austria","+43"],["AZ","Azerbaijan","+994"],
  ["BS","Bahamas","+1"],["BH","Bahrain","+973"],["BD","Bangladesh","+880"],
  ["BB","Barbados","+1"],["BY","Belarus","+375"],["BE","Belgium","+32"],
  ["BZ","Belize","+501"],["BJ","Benin","+229"],["BM","Bermuda","+1"],
  ["BT","Bhutan","+975"],["BO","Bolivia","+591"],["BA","Bosnia and Herzegovina","+387"],
  ["BW","Botswana","+267"],["BR","Brazil","+55"],["BN","Brunei","+673"],
  ["BG","Bulgaria","+359"],["BF","Burkina Faso","+226"],["BI","Burundi","+257"],
  ["CV","Cabo Verde","+238"],["KH","Cambodia","+855"],["CM","Cameroon","+237"],
  ["CA","Canada","+1"],["KY","Cayman Islands","+1"],["CF","Central African Republic","+236"],
  ["TD","Chad","+235"],["CL","Chile","+56"],["CN","China","+86"],
  ["CO","Colombia","+57"],["KM","Comoros","+269"],["CG","Congo (Republic)","+242"],
  ["CD","Congo (DR)","+243"],["CR","Costa Rica","+506"],["CI","Côte d'Ivoire","+225"],
  ["HR","Croatia","+385"],["CU","Cuba","+53"],["CW","Curaçao","+599"],
  ["CY","Cyprus","+357"],["CZ","Czechia","+420"],["DK","Denmark","+45"],
  ["DJ","Djibouti","+253"],["DM","Dominica","+1"],["DO","Dominican Republic","+1"],
  ["EC","Ecuador","+593"],["EG","Egypt","+20"],["SV","El Salvador","+503"],
  ["GQ","Equatorial Guinea","+240"],["ER","Eritrea","+291"],["EE","Estonia","+372"],
  ["SZ","Eswatini","+268"],["ET","Ethiopia","+251"],["FO","Faroe Islands","+298"],
  ["FJ","Fiji","+679"],["FI","Finland","+358"],["FR","France","+33"],
  ["GF","French Guiana","+594"],["PF","French Polynesia","+689"],["GA","Gabon","+241"],
  ["GM","Gambia","+220"],["GE","Georgia","+995"],["DE","Germany","+49"],
  ["GH","Ghana","+233"],["GR","Greece","+30"],["GL","Greenland","+299"],
  ["GD","Grenada","+1"],["GP","Guadeloupe","+590"],["GU","Guam","+1"],
  ["GT","Guatemala","+502"],["GN","Guinea","+224"],["GW","Guinea-Bissau","+245"],
  ["GY","Guyana","+592"],["HT","Haiti","+509"],["HN","Honduras","+504"],
  ["HK","Hong Kong","+852"],["HU","Hungary","+36"],["IS","Iceland","+354"],
  ["IN","India","+91"],["ID","Indonesia","+62"],["IR","Iran","+98"],
  ["IQ","Iraq","+964"],["IE","Ireland","+353"],["IL","Israel","+972"],
  ["IT","Italy","+39"],["JM","Jamaica","+1"],["JP","Japan","+81"],
  ["JO","Jordan","+962"],["KZ","Kazakhstan","+7"],["KE","Kenya","+254"],
  ["KI","Kiribati","+686"],["XK","Kosovo","+383"],["KW","Kuwait","+965"],
  ["KG","Kyrgyzstan","+996"],["LA","Laos","+856"],["LV","Latvia","+371"],
  ["LB","Lebanon","+961"],["LS","Lesotho","+266"],["LR","Liberia","+231"],
  ["LY","Libya","+218"],["LI","Liechtenstein","+423"],["LT","Lithuania","+370"],
  ["LU","Luxembourg","+352"],["MO","Macao","+853"],["MG","Madagascar","+261"],
  ["MW","Malawi","+265"],["MY","Malaysia","+60"],["MV","Maldives","+960"],
  ["ML","Mali","+223"],["MT","Malta","+356"],["MH","Marshall Islands","+692"],
  ["MQ","Martinique","+596"],["MR","Mauritania","+222"],["MU","Mauritius","+230"],
  ["YT","Mayotte","+262"],["MX","Mexico","+52"],["FM","Micronesia","+691"],
  ["MD","Moldova","+373"],["MC","Monaco","+377"],["MN","Mongolia","+976"],
  ["ME","Montenegro","+382"],["MA","Morocco","+212"],["MZ","Mozambique","+258"],
  ["MM","Myanmar","+95"],["NA","Namibia","+264"],["NR","Nauru","+674"],
  ["NP","Nepal","+977"],["NL","Netherlands","+31"],["NC","New Caledonia","+687"],
  ["NZ","New Zealand","+64"],["NI","Nicaragua","+505"],["NE","Niger","+227"],
  ["NG","Nigeria","+234"],["KP","North Korea","+850"],["MK","North Macedonia","+389"],
  ["NO","Norway","+47"],["OM","Oman","+968"],["PK","Pakistan","+92"],
  ["PW","Palau","+680"],["PS","Palestine","+970"],["PA","Panama","+507"],
  ["PG","Papua New Guinea","+675"],["PY","Paraguay","+595"],["PE","Peru","+51"],
  ["PH","Philippines","+63"],["PL","Poland","+48"],["PT","Portugal","+351"],
  ["PR","Puerto Rico","+1"],["QA","Qatar","+974"],["RE","Réunion","+262"],
  ["RO","Romania","+40"],["RU","Russia","+7"],["RW","Rwanda","+250"],
  ["KN","Saint Kitts and Nevis","+1"],["LC","Saint Lucia","+1"],
  ["VC","Saint Vincent and the Grenadines","+1"],["WS","Samoa","+685"],
  ["SM","San Marino","+378"],["ST","São Tomé and Príncipe","+239"],
  ["SA","Saudi Arabia","+966"],["SN","Senegal","+221"],["RS","Serbia","+381"],
  ["SC","Seychelles","+248"],["SL","Sierra Leone","+232"],["SG","Singapore","+65"],
  ["SK","Slovakia","+421"],["SI","Slovenia","+386"],["SB","Solomon Islands","+677"],
  ["SO","Somalia","+252"],["ZA","South Africa","+27"],["KR","South Korea","+82"],
  ["SS","South Sudan","+211"],["ES","Spain","+34"],["LK","Sri Lanka","+94"],
  ["SD","Sudan","+249"],["SR","Suriname","+597"],["SE","Sweden","+46"],
  ["CH","Switzerland","+41"],["SY","Syria","+963"],["TW","Taiwan","+886"],
  ["TJ","Tajikistan","+992"],["TZ","Tanzania","+255"],["TH","Thailand","+66"],
  ["TL","Timor-Leste","+670"],["TG","Togo","+228"],["TO","Tonga","+676"],
  ["TT","Trinidad and Tobago","+1"],["TN","Tunisia","+216"],["TR","Türkiye","+90"],
  ["TM","Turkmenistan","+993"],["TV","Tuvalu","+688"],["UG","Uganda","+256"],
  ["UA","Ukraine","+380"],["AE","United Arab Emirates","+971"],
  ["GB","United Kingdom","+44"],["US","United States","+1"],["UY","Uruguay","+598"],
  ["UZ","Uzbekistan","+998"],["VU","Vanuatu","+678"],["VA","Vatican City","+379"],
  ["VE","Venezuela","+58"],["VN","Vietnam","+84"],["YE","Yemen","+967"],
  ["ZM","Zambia","+260"],["ZW","Zimbabwe","+263"]
];

export const COUNTRIES = RAW_COUNTRIES
  .map(([iso, name, dial]) => ({ iso, name, dial }))
  .sort((a, b) => a.name.localeCompare(b.name));

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
const BY_NAME = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));

export function countryByIso(iso) {
  return BY_ISO.get(String(iso || "").toUpperCase()) || null;
}

// Real flag from the two-letter code (works on phones; some Windows
// computers show the letters instead of a picture).
export function flag(iso) {
  const code = String(iso || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(
    ...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  );
}

/** "🇺🇬 Uganda" for a user document (also understands old typed text). */
export function countryLabel(user) {
  if (!user) return "";
  const byCode = countryByIso(user.countryCode);
  if (byCode) return flag(byCode.iso) + " " + byCode.name;

  const text = String(user.country || user.nationality || "").trim();
  if (!text) return "";
  const match = BY_NAME.get(text.toLowerCase());
  return match ? flag(match.iso) + " " + match.name : text;
}

/** Find the ISO code for a user document (code first, then old text). */
export function countryIsoOf(user) {
  if (!user) return "";
  if (countryByIso(user.countryCode)) return String(user.countryCode).toUpperCase();
  const match = BY_NAME.get(String(user.country || user.nationality || "").trim().toLowerCase());
  return match ? match.iso : "";
}

export function genderLabel(gender) {
  const g = String(gender || "").trim().toLowerCase();
  if (g === "male") return "♂ Male";
  if (g === "female") return "♀ Female";
  return "";
}

// ---------------------------------------------------------
// SELECT BOXES
// ---------------------------------------------------------
export function fillCountrySelect(select, selectedIso, placeholder) {
  if (!select) return;
  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder || "Select your country";
  select.appendChild(first);

  COUNTRIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.iso;
    opt.textContent = flag(c.iso) + "  " + c.name;
    select.appendChild(opt);
  });

  select.value = selectedIso && BY_ISO.has(selectedIso) ? selectedIso : "";
}

/** Phone-code box. The option VALUE is the country code (so +1 countries stay distinct). */
export function fillDialSelect(select, selectedIso) {
  if (!select) return;
  select.innerHTML = "";

  COUNTRIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.iso;
    opt.textContent = flag(c.iso) + " " + c.dial;
    opt.title = c.name + " (" + c.dial + ")";
    select.appendChild(opt);
  });

  select.value = BY_ISO.has(selectedIso) ? selectedIso : "UG";
}

// ---------------------------------------------------------
// NAME
// ---------------------------------------------------------
const JUNK_NAMES = new Set([
  "nothing","none","null","undefined","nan","test","testing","tester","asdf","asdfg",
  "asdfgh","qwerty","qwert","abc","abcd","abcde","xyz","fake","unknown","noname",
  "noone","nobody","name","username","user","firstname","lastname","fullname",
  "myname","yourname","somebody","someone","anonymous","anon","guest","idk","no",
  "yes","hello","hi","lol","johndoe","janedoe","admin","administrator","moderator",
  "staff","owner","support","friendszone","friendzone","friendszonechatcity",
  "mod","official"
]);

const KEYBOARD_RUNS = ["qwert","werty","ertyu","asdfg","sdfgh","dfghj","zxcvb","xcvbn","hjkl","uiop","1234"];

function plainLetters(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function cleanName(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

export function validateName(raw) {
  const name = cleanName(raw);

  if (!name) return { ok: false, error: "Please enter your name." };
  if (name.length < 2) return { ok: false, error: "Your name is too short." };
  if (name.length > 40) return { ok: false, error: "Your name is too long (40 letters at most)." };

  if (/\d/.test(name)) {
    return { ok: false, error: "A name cannot contain numbers." };
  }
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'’.\-]*$/u.test(name)) {
    return { ok: false, error: "Use only letters in your name (spaces, - and ' are fine)." };
  }

  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return { ok: false, error: "Please enter your real name." };

  if (/(\p{L})\1\1/u.test(name.toLowerCase())) {
    return { ok: false, error: "That doesn't look like a real name." };
  }

  const plain = plainLetters(name);
  if (plain && JUNK_NAMES.has(plain)) {
    return { ok: false, error: "Please enter your real name." };
  }
  if (plain.length >= 4 && KEYBOARD_RUNS.some((run) => plain.includes(run))) {
    return { ok: false, error: "That doesn't look like a real name." };
  }
  if (plain.length >= 5 && !/[aeiouy]/.test(plain)) {
    return { ok: false, error: "That doesn't look like a real name." };
  }

  return { ok: true, value: name };
}

// ---------------------------------------------------------
// EMAIL
// ---------------------------------------------------------
const FAKE_EMAIL_DOMAINS = new Set([
  "example.com","example.org","example.net","test.com","test.org","tests.com",
  "nothing.com","none.com","fake.com","fakemail.com","noemail.com","nomail.com",
  "email.test","domain.com","mail.com.test","asdf.com","abc.com","xyz.com",
  "mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org",
  "guerrillamail.biz","guerrillamail.de","sharklasers.com","grr.la","spam4.me",
  "10minutemail.com","10minutemail.net","tempmail.com","temp-mail.org","temp-mail.io",
  "tempmailo.com","tempail.com","yopmail.com","yopmail.net","yopmail.fr",
  "trashmail.com","trashmail.net","getnada.com","nada.email","throwawaymail.com",
  "maildrop.cc","dispostable.com","fakeinbox.com","mintemail.com","mohmal.com",
  "emailondeck.com","burnermail.io","moakt.com","discard.email","spamgourmet.com",
  "mailnesia.com","mytemp.email","tmpmail.org","tmpmail.net","minuteinbox.com",
  "emailfake.com","fakemailgenerator.com","mailcatch.com","inboxkitten.com"
]);

const EMAIL_TYPOS = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com",
  "gnail.com": "gmail.com", "gmal.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmail.con": "hotmail.com",
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "outlok.com": "outlook.com", "outllok.com": "outlook.com", "outlook.con": "outlook.com",
  "icloud.con": "icloud.com", "iclod.com": "icloud.com"
};

const JUNK_EMAIL_LOCALS = new Set([
  "test","tester","testing","asdf","asdfg","qwerty","abc","abcd","abcde","xyz",
  "email","mail","none","nothing","fake","noone","nobody","user","username","name",
  "example","sample","demo","null","undefined","no","yes","hello","admin","a","aa","aaa"
]);

export function cleanEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function validateEmail(raw) {
  const email = cleanEmail(raw);

  if (!email) return { ok: false, error: "Please enter your email." };
  if (email.length > 254) return { ok: false, error: "That email is too long." };

  const pattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
  if (!pattern.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const [local, domain] = email.split("@");
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const tld = domain.split(".").pop();
  if (!/^[a-z]{2,24}$/.test(tld)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  if (EMAIL_TYPOS[domain]) {
    return { ok: false, error: `Did you mean ${local}@${EMAIL_TYPOS[domain]} ?` };
  }

  if (FAKE_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, error: "Please use your real email address (not a temporary or fake one)." };
  }

  const plainLocal = local.replace(/[^a-z]/g, "");
  if (JUNK_EMAIL_LOCALS.has(plainLocal) || /^(.)\1{3,}$/.test(plainLocal)) {
    return { ok: false, error: "Please use your real email address." };
  }

  return { ok: true, value: email };
}

// ---------------------------------------------------------
// PASSWORD
// ---------------------------------------------------------
const WEAK_PASSWORDS = new Set([
  "password","password1","password123","12345678","123456789","1234567890",
  "qwertyui","qwerty123","iloveyou","11111111","00000000","abcd1234","admin123",
  "letmein1","welcome1","friendszone","friendszone1"
]);

export function validatePassword(password, confirm) {
  const p = String(password || "");
  if (!p) return { ok: false, error: "Please create a password." };
  if (p.length < 8) return { ok: false, error: "Use at least 8 characters." };
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) {
    return { ok: false, error: "Mix letters and numbers in your password." };
  }
  if (WEAK_PASSWORDS.has(p.toLowerCase())) {
    return { ok: false, error: "That password is too easy to guess." };
  }
  if (confirm !== undefined && p !== confirm) {
    return { ok: false, error: "The two passwords do not match." };
  }
  return { ok: true, value: p };
}

// ---------------------------------------------------------
// DATE OF BIRTH
// ---------------------------------------------------------
export function ageFromDob(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function validateDob(dob) {
  if (!dob) return { ok: false, error: "Please enter your date of birth." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return { ok: false, error: "Please enter a valid date of birth." };
  }
  const age = ageFromDob(dob);
  if (age === null) return { ok: false, error: "Please enter a valid date of birth." };
  if (new Date(dob) > new Date()) return { ok: false, error: "Your date of birth cannot be in the future." };
  if (age < MIN_AGE) return { ok: false, error: `You must be at least ${MIN_AGE} years old to join.` };
  if (age > MAX_AGE) return { ok: false, error: "Please enter your real date of birth." };
  return { ok: true, value: dob, age };
}

/** Earliest / latest dates for the date box. */
export function dobLimits() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    min: fmt(new Date(now.getFullYear() - MAX_AGE, now.getMonth(), now.getDate())),
    max: fmt(new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate()))
  };
}

// ---------------------------------------------------------
// PHONE
// Lengths are the digits AFTER the country code (no leading 0).
// Countries not listed use a general 6–12 digit rule.
// ---------------------------------------------------------
const PHONE_LENGTHS = {
  UG: [9], KE: [9], TZ: [9], RW: [9], BI: [8], SS: [9], CD: [9], ET: [9],
  SO: [8, 9], SD: [9], NG: [10], GH: [9], ZA: [9], ZW: [9], ZM: [9], MW: [7, 9],
  MZ: [9], AO: [9], CM: [9], SN: [9], CI: [10], EG: [10], MA: [9], DZ: [9], TN: [8],
  US: [10], CA: [10], MX: [10], BR: [10, 11], AR: [10], CO: [10], CL: [9], PE: [9],
  VE: [10], GB: [10], IE: [9], FR: [9], DE: [10, 11], IT: [9, 10], ES: [9], PT: [9],
  NL: [9], BE: [9], CH: [9], IN: [10], PK: [10], BD: [10], CN: [11], JP: [10],
  KR: [9, 10], PH: [10], ID: [9, 10, 11, 12], MY: [9, 10], SG: [8], TH: [9], VN: [9],
  TR: [10], SA: [9], AE: [9], QA: [8], KW: [8], IL: [9], AU: [9], NZ: [8, 9, 10], RU: [10], KZ: [10]
};
["AG","BS","BB","BM","KY","DM","DO","GD","GU","JM","PR","KN","LC","VC","TT"].forEach((iso) => {
  PHONE_LENGTHS[iso] = [10];
});

function looksFakeNumber(digits) {
  if (/^(\d)\1+$/.test(digits)) return true;                 // 7777777
  if (/(\d)\1{6,}/.test(digits)) return true;                // 7000000000
  const zeros = (digits.match(/0/g) || []).length;
  if (digits.length >= 7 && zeros >= digits.length - 2) return true;
  const up = "01234567890123456789";
  const down = "98765432109876543210";
  if (digits.length >= 6 && (up.includes(digits) || down.includes(digits))) return true;
  return false;
}

/**
 * Returns { ok, e164, national, iso } or { ok:false, error }.
 *   iso      - country code chosen in the phone-code box (e.g. "UG")
 *   rawInput - what the person typed in the number box
 */
export function validatePhone(iso, rawInput) {
  const country = countryByIso(iso);
  if (!country) return { ok: false, error: "Choose your phone country code." };

  let text = String(rawInput || "").trim();
  if (!text) return { ok: false, error: "Please enter your phone number." };

  // 0000000000 / 1111111111 and similar are never real numbers
  const quickDigits = text.replace(/\D/g, "");
  if (quickDigits.length >= 5 && /^(\d)\1+$/.test(quickDigits)) {
    return { ok: false, error: "Please enter your real phone number." };
  }

  // Person typed the whole international number in the number box
  if (text.startsWith("+") || text.startsWith("00")) {
    const plus = text.startsWith("00") ? "+" + text.slice(2) : text;
    const dialDigits = country.dial.replace("+", "");
    const digitsOnly = plus.replace(/\D/g, "");
    if (digitsOnly.startsWith(dialDigits)) {
      text = digitsOnly.slice(dialDigits.length);
    } else {
      return {
        ok: false,
        error: "That number starts with a different country code. Pick the right code in the box on the left."
      };
    }
  }

  if (/[^\d\s\-().]/.test(text)) {
    return { ok: false, error: "A phone number can only contain digits." };
  }

  const digits = text.replace(/\D/g, "");
  if (!digits) return { ok: false, error: "Please enter your phone number." };

  const allowed = PHONE_LENGTHS[country.iso];
  const fits = (d) => (allowed ? allowed.includes(d.length) : d.length >= 6 && d.length <= 12);

  // try without the leading 0 first (0700123456 -> 700123456)
  const candidates = digits.startsWith("0") ? [digits.replace(/^0/, ""), digits] : [digits];
  const national = candidates.find((d) => fits(d));

  if (!national) {
    const want = allowed ? allowed.join(" or ") + " digits" : "6 to 12 digits";
    return {
      ok: false,
      error: `That doesn't look like a ${country.name} number. It should have ${want} after ${country.dial}.`
    };
  }

  if (looksFakeNumber(national)) {
    return { ok: false, error: "Please enter your real phone number." };
  }

  const e164 = country.dial + national;
  if (e164.replace("+", "").length > 15) {
    return { ok: false, error: "That phone number is too long." };
  }

  return { ok: true, e164, national, iso: country.iso };
}

/**
 * Split a saved number like "+256700123456" into { iso, national }.
 * Old numbers typed without a country code come back with iso "" .
 */
export function splitStoredPhone(stored, preferredIso) {
  const text = String(stored || "").trim();
  if (!text.startsWith("+")) {
    return { iso: "", national: text.replace(/\D/g, "").replace(/^0/, "") };
  }
  const digits = text.slice(1).replace(/\D/g, "");

  // prefer the country already chosen (so +1 numbers keep the right flag)
  const preferred = countryByIso(preferredIso);
  if (preferred && digits.startsWith(preferred.dial.replace("+", ""))) {
    return { iso: preferred.iso, national: digits.slice(preferred.dial.length - 1) };
  }

  let best = null;
  COUNTRIES.forEach((c) => {
    const d = c.dial.replace("+", "");
    if (digits.startsWith(d) && (!best || d.length > best.dial.length - 1)) best = c;
  });
  return best
    ? { iso: best.iso, national: digits.slice(best.dial.length - 1) }
    : { iso: "", national: digits };
}

// ---------------------------------------------------------
// COUNTRY CHOICE
// ---------------------------------------------------------
export function validateCountry(iso) {
  const c = countryByIso(iso);
  if (!c) return { ok: false, error: "Please choose your country." };
  return { ok: true, value: c };
}
