import { error } from 'console';
import fsp from 'fs/promises';
import { PNG } from 'pngjs';

const CURRENT_EMOJIS_PATH = '../current';
const OLD_EMOJIS_PATH = '../old';

const CURRENT_EMOJI_FILES = await fsp.readdir(CURRENT_EMOJIS_PATH);
const EMOJI_CREDITS = await parseCsv('../credits.csv');
const OLD_EMOJI_FILES = await fsp.readdir(OLD_EMOJIS_PATH);
const EMOJI_PALETTE = await fetchEmojiPaltte();


console.log("\nchecking current emojis...");

for (const emojiFileName of CURRENT_EMOJI_FILES) {
	let emojiTrueName = emojiFileName.split('.')[0];
	let errors = [];

	if (!/^[a-z]+$/.test(emojiTrueName)) errors.push('name contains invalid characters');


	let credit = EMOJI_CREDITS[emojiTrueName+"_v1"];
	if (credit) {
		let latestVersion = 1;
		while (EMOJI_CREDITS[emojiTrueName+"_v"+(latestVersion+1)]) latestVersion++;
		credit = EMOJI_CREDITS[emojiTrueName+"_v"+latestVersion];

		if (!credit.author || credit.author.length == 0) errors.push('missing original_author');
		if (!credit.date || credit.date.length == 0) errors.push('missing date');
		else if (!/^\d{4}-\d{2}-\d{2}$/.test(credit.date)) errors.push('date is not in yyyy-mm-dd format');
	} else
		errors.push('missing credit');

	if (emojiFileName.includes('.png')) {
		try {
			const currentImage = await fsp.readFile(`${CURRENT_EMOJIS_PATH}/${emojiFileName}`);
			const png = PNG.sync.read(currentImage);

			if (png.width !== 16) errors.push('image width is '+png.width+' instead of 16');
			if (png.height !== 16) errors.push('image height is '+png.height+' instead of 16');
			try {ensureEmojiOnlyUsesPaletteColors(png)} catch (err) {errors.push(err)}


		} catch (err) {
			errors.push('failed to load png: '+err);
		}
	}
	else errors.push('file extension is not .png');


	if (errors.length == 0) console.log('✔️ current/'+emojiFileName);
	else {
		//loop through errors and print out each one
		errors.forEach((err) => {
			console.error('❌ current/'+emojiFileName+' - '+err);
		});
		process.exitCode = 1;
	}
}


console.log("\nchecking old emojis...");

for (const emojiFileName of OLD_EMOJI_FILES) {
	let emojiFullName = emojiFileName.split('.')[0];
	let emojiTrueName = emojiFullName.split('_')[0];
	let emojiVersion = emojiFullName.split('_')[1].replace('v', '');
	let errors = [];

	if (!/^[a-z]+$/.test(emojiTrueName)) errors.push('name contains invalid characters');
	if (!/^\d+$/.test(emojiVersion)) errors.push('version "'+emojiVersion+'" is not a number');

	let version = EMOJI_CREDITS[emojiFullName];
	if (version) {
		
		if (version.version > 1){
			let previousVersion = emojiTrueName+'_v'+(version.version-1) + '.png';
			if (!OLD_EMOJI_FILES.includes(previousVersion)) errors.push('previous version (v'+(version.version-1)+') does not exist');
		}

		if (!version.author || version.author.length == 0) errors.push('missing author');

		if (!version.date || version.date.length == 0) errors.push('missing date');
		else if (!/^\d{4}-\d{2}-\d{2}$/.test(version.date)) errors.push('date is not in yyyy-mm-dd format');

	} else
		errors.push('missing version info');

	if (!CURRENT_EMOJI_FILES.includes(emojiTrueName+'.png')) errors.push('corresponding current emoji not found');

	if (!emojiFileName.includes('.png')) errors.push('file extension is not .png');

	if (errors.length == 0) console.log('✔️ current/'+emojiFileName);
	else {
		//loop through errors and print out each one
		errors.forEach((err) => {
			console.error('❌ current/'+emojiFileName+' - '+err);
		});
		process.exitCode = 1;
	}
}


function ensureEmojiOnlyUsesPaletteColors (png) {
	const illegalColors = [];

	for (let i = 0; i < png.data.length; i += 4) {
		if (png.data[i+3] === 0) continue; //skip transparent pixels
		const color = RGBToHex(png.data[i], png.data[i+1], png.data[i+2]);
		if (!EMOJI_PALETTE.includes(color) && !illegalColors.includes(color)) 
			illegalColors.push(color);
	}

	if (illegalColors.length > 0) {
		throw 'image contains illegal colors: '+illegalColors.join(', ');
	}
}

function RGBToHex (r,g,b) {
	return ((r << 16) + (g << 8) + b).toString(16).padStart(6, '0');
}

async function fetchEmojiPaltte () {
	const response = await fetch('https://lospec.com/palette-list/lospec-emoji.json');
	const data = await response.json();
	return data.colors;
}

async function parseCsv (path) {
	const csv = await fsp.readFile(path, 'utf-8');
	const lines = csv.split(/\r?\n/);
	const headers = lines[0].split(',');

	let outputObject = {}
	for (let i = 1; i < lines.length; i++) {
		const obj = {};
		const currentLine = lines[i].split(',');

		for (let j = 0; j < headers.length; j++) {
			obj[headers[j]] = currentLine[j];
		}

		outputObject[obj['name']+'_v'+obj['version']] = obj;
	}

	return outputObject;
}

if (process.exitCode) console.error('\nRESULT: ❌ validation failed');
else console.log('\nRESULT: ✔️ validation passed');