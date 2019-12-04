const fs = require('fs'),
	path = require('path'),
	GREETS_PATH = __dirname + '\\greets.txt'

let greets = []
/*
[
	{
		alias:[],
		greet:[]
	},
	...
]
*/
function load() {
	try {
		let oldGreets = greets;
		greets = []
		let lines = fs.readFileSync(GREETS_PATH, 'utf8');
		lines = lines.split(/[\r\n]+/g);
		for (let line of lines) {
			let sections = line.split('@');
			if (sections.length < 2) continue
			let dataobj = {
				alias: sections[0].replace(/\s/g, '').split('¤'),
				greet: sections[1].split('¤')
			};
			greets.push(dataobj);
		}
		//console.log(greets)
		if (greets && oldGreets != greets) {
			console.log("greets.txt changes loaded")
		}
	} catch (e) {
		console.log("greets.txt changes loading error")
		console.log(e);
	}
}
load();


module.exports = function Greets(mod) {
	const command = mod.command || mod.require.command
	let greetMessage = '';
	let players = {}
	let entityMap = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
		'/': '&#x2F;',
		'`': '&#x60;',
		'=': '&#x3D;'
	};

	let watcher = fs.watch(GREETS_PATH, event => {
		if (event === 'change') {
			load();
		}
	});

	command.add('greet', (...args) => {
		args[0] = args[0].toLowerCase()
		switch (args[0]) {
			case 'save':
				saveGreets()
				command.message('Greets saved to greets.json')
				break
			default:
				console.log(greets)
				break
		}
	})

	function escapeHtml(string) {
		return String(string).replace(/[&<>"'`=\/]/g, function (s) {
			return entityMap[s];
		});
	}

	function getGreet(id) {
		if (!greets) return '';
		try {
			// console.log(id)
			// console.log(Object.keys(players))			
			var name = players[id].name
		} catch (e) {
			console.log("Greeted but id not found")
			console.log(e)
			return
		}
		if (!name) return '';
		for (let key of greets) {
			// console.log(name + " - " + key)
			if (key.alias.includes(name)) {
				let rnd = key.greet.length * Math.random() << 0
				return key.greet[rnd]
			}
		}
		// console.log("Greeted but name not found in config")
		return ''
	}

	mod.hook('S_SPAWN_USER', 15, (event) => {
		let id = event.gameId
		players[id] = {}
		players[id].name = event.name
	});

	mod.hook('S_DESPAWN_USER', 3, (event) => {
		let id = event.gameId
		delete players[id]
	});

	mod.hook('C_START_INSTANCE_SKILL', 7, (event) => {
		if (event.skill.id === 60401301) {
			// console.log(event.targets);
			// console.log(Object.keys(players))
			// Try pruning non-player targets
			event.targets = event.targets.filter(targ => Object.keys(players).map(x => BigInt(x)).includes(targ.gameId));
			// console.log(event.targets);

			// Assuming here the first target is always chosen
			if (event.targets.length > 0) {
				let id = event.targets[0].gameId
				greetMessage = getGreet(id)
				// console.log('Name: ' + players[id].name);
				// console.log('Greet message: ' + greetMessage);
			}
		}
	});

	//modify sent greeting message
	mod.hook('C_CHAT', 1, (event) => {
		if (event.channel === 9 && greetMessage) {
			event.message = "<FONT>" + escapeHtml(greetMessage) + "</FONT>";
			greetMessage = null
			return true;
		}
	});

	function saveGreets() {
		fs.writeFile(path.join(__dirname, 'greets.json'), JSON.stringify(greets, null, '\t'), err => { });
	}

	this.destructor = () => {
		watcher.close()
		command.remove('greet')
	}
};