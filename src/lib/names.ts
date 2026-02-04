// Dutch Name Generator - Realistische Nederlandse namen

const FIRST_NAMES_MALE = [
  'Jan', 'Piet', 'Klaas', 'Henk', 'Willem', 'Johan', 'Peter', 'Martin', 'Frank', 'Erik',
  'Mark', 'Jeroen', 'Bas', 'Tom', 'Lars', 'Sander', 'Niels', 'Dennis', 'Marco', 'Arjan',
  'Remco', 'Wouter', 'Joost', 'Ruud', 'Bert', 'Hans', 'Geert', 'Rob', 'Kees', 'Joop',
  'Wim', 'Cor', 'Dirk', 'Paul', 'Michiel', 'Bram', 'Martijn', 'Rik', 'Gert', 'Stefan',
  'Ronald', 'Vincent', 'Alexander', 'Daan', 'Tim', 'Kevin', 'Richard', 'Marcel', 'Raymond', 'Patrick'
]

const FIRST_NAMES_FEMALE = [
  'Maria', 'Anna', 'Johanna', 'Wilma', 'Anja', 'Petra', 'Linda', 'Sandra', 'Nicole', 'Monique',
  'Marieke', 'Ingrid', 'Esther', 'Ellen', 'Annemarie', 'Judith', 'Wendy', 'Miranda', 'Karin', 'Astrid',
  'Marloes', 'Joke', 'Tineke', 'Marianne', 'Anita', 'Corina', 'Diana', 'Bianca', 'Manon', 'Lisa',
  'Emma', 'Sophie', 'Julia', 'Eva', 'Sanne', 'Fleur', 'Lotte', 'Iris', 'Anne', 'Femke',
  'Marjan', 'Yvonne', 'Carla', 'Renate', 'Simone', 'Ilse', 'Margriet', 'Nienke', 'Rianne', 'Chantal'
]

const LAST_NAMES = [
  'de Jong', 'Jansen', 'de Vries', 'van den Berg', 'van Dijk', 'Bakker', 'Janssen', 'Visser',
  'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen',
  'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Smits', 'de Graaf', 'van der Meer', 'van der Linden',
  'Kok', 'Jacobs', 'de Haan', 'Vermeer', 'van den Heuvel', 'van der Veen', 'van den Broek', 'de Bruin',
  'van der Heijden', 'Schouten', 'van Beek', 'Willems', 'van Vliet', 'van der Wal', 'Hoekstra', 'Maas',
  'Verhoeven', 'Koster', 'van Dam', 'van der Pol', 'Prins', 'Blom', 'Huisman', 'Peeters',
  'van Wijk', 'van der Zanden', 'Postma', 'Kuipers', 'van Es', 'de Ruiter', 'van Loon', 'Gerritsen',
  'Timmermans', 'Groen', 'van der Steen', 'Koopman', 'Hermans', 'van Schaik', 'Bosch', 'de Lange'
]

// Initialen formaat (bijv. "J. de Vries")
const USE_INITIAL_CHANCE = 0.2

/**
 * Genereer een willekeurige Nederlandse naam
 */
export function generateDutchName(): string {
  const isMale = Math.random() > 0.5
  const firstNames = isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  
  // Soms alleen initiaal gebruiken
  if (Math.random() < USE_INITIAL_CHANCE) {
    return `${firstName.charAt(0)}. ${lastName}`
  }
  
  return `${firstName} ${lastName}`
}

/**
 * Genereer meerdere unieke Nederlandse namen
 */
export function generateDutchNames(count: number): string[] {
  const names = new Set<string>()
  
  while (names.size < count) {
    names.add(generateDutchName())
  }
  
  return Array.from(names)
}

/**
 * Genereer alleen een voornaam
 */
export function generateFirstName(gender?: 'male' | 'female'): string {
  const isMale = gender === 'male' || (gender === undefined && Math.random() > 0.5)
  const firstNames = isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE
  return firstNames[Math.floor(Math.random() * firstNames.length)]
}

export { FIRST_NAMES_MALE, FIRST_NAMES_FEMALE, LAST_NAMES }
