export interface Reciter {
	id: string;
	name: string;
	style: string;
	folder: string;
}

// Folder sesuai daftar resmi https://everyayah.com/data/recitations.js
export const RECITERS: Reciter[] = [
	{ id: 'alafasy', name: 'Mishary Rashid Alafasy', style: 'Murattal', folder: 'Alafasy_128kbps' },
	{ id: 'abdulbasit', name: 'Abdul Basit Abdus Samad', style: 'Murattal', folder: 'Abdul_Basit_Murattal_192kbps' },
	{ id: 'abdulbasit-mj', name: 'Abdul Basit Abdus Samad', style: 'Mujawwad', folder: 'Abdul_Basit_Mujawwad_128kbps' },
	{ id: 'husary', name: 'Mahmoud Khalil Al-Husary', style: 'Murattal', folder: 'Husary_128kbps' },
	{ id: 'husary-muallim', name: 'Mahmoud Khalil Al-Husary', style: "Mu'allim (belajar)", folder: 'Husary_Muallim_128kbps' },
	{ id: 'minshawi', name: 'Muhammad Siddiq Al-Minshawi', style: 'Murattal', folder: 'Minshawy_Murattal_128kbps' },
	{ id: 'sudais', name: 'Abdurrahman As-Sudais', style: 'Murattal', folder: 'Abdurrahmaan_As-Sudais_192kbps' },
	{ id: 'shuraim', name: "Sa'ud Ash-Shuraim", style: 'Murattal', folder: 'Saood_ash-Shuraym_128kbps' },
	{ id: 'muaiqly', name: 'Maher Al-Muaiqly', style: 'Murattal', folder: 'MaherAlMuaiqly128kbps' },
	{ id: 'shatri', name: 'Abu Bakr Ash-Shatri', style: 'Murattal', folder: 'Abu_Bakr_Ash-Shaatree_128kbps' },
	{ id: 'rifai', name: "Hani Ar-Rifa'i", style: 'Murattal', folder: 'Hani_Rifai_192kbps' },
	{ id: 'dossari', name: 'Yasser Ad-Dossari', style: 'Murattal', folder: 'Yasser_Ad-Dussary_128kbps' },
	{ id: 'qatami', name: 'Nasser Al-Qatami', style: 'Murattal', folder: 'Nasser_Alqatami_128kbps' },
	{ id: 'ajmi', name: 'Ahmad bin Ali Al-Ajmi', style: 'Murattal', folder: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net' },
	{ id: 'ayyub', name: 'Muhammad Ayyub', style: 'Murattal', folder: 'Muhammad_Ayyoub_128kbps' },
	{ id: 'hudhaifi', name: 'Ali Al-Hudhaifi', style: 'Murattal', folder: 'Hudhaify_128kbps' },
	{ id: 'jibreel', name: 'Muhammad Jibreel', style: 'Murattal', folder: 'Muhammad_Jibreel_128kbps' },
	{ id: 'bukhatir', name: 'Salah Bukhatir', style: 'Murattal', folder: 'Salaah_AbdulRahman_Bukhatir_128kbps' },
	{ id: 'juhany', name: 'Abdullah Al-Juhany', style: 'Murattal', folder: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps' },
	{ id: 'ghamdi', name: "Sa'ad Al-Ghamdi", style: 'Murattal', folder: 'Ghamadi_40kbps' },
	{ id: 'abbad', name: 'Fares Abbad', style: 'Murattal', folder: 'Fares_Abbad_64kbps' },
];

export const getReciter = (id: string) => RECITERS.find((r) => r.id === id) ?? RECITERS[0];

export function ayahAudioUrl(r: Reciter, surah: number, ayah: number) {
	return `https://everyayah.com/data/${r.folder}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}
