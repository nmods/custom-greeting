const fs = require('fs'),
	path = require('path'),
	request = require('node-fetch'),
	Vec3 = require('tera-vec3'),
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
	let greetMessage = {}
	let greetName = ''
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

	let config = require('./config.json');
	let apis = require('./apis.json');

	let errorCount = 0

	let watcher = fs.watch(GREETS_PATH, event => {
		if (event === 'change') {
			load();
		}
	});

	command.add('greet', (...args) => {
		if(args[0]) args[0] = args[0].toLowerCase()
		switch (args[0]) {
			case 'save':
				saveGreets()
				command.message('Greets saved to greets.json')
				break
			case 'test':
				errorCount = 0
				getRandomGreeting(msg => command.message(msg))
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

	function random(min, max) {
		if (Array.isArray(min)) {
			return min[random(min.length)]
		}
		if (!max && min) {
			max = min
			min = 0
		}
		return Math.floor(Math.random() * (max - min) + min)
	}

	function getGreet(id) {
		if (!greets) return '';
		try {
			// console.log(id)
			// console.log(Object.keys(players))			
			var name = players[id].name
		} catch (e) {
			console.log("Greeted but id not found")
		}
		let d=""
		for (let key of greets) {
			console.log(key)
			if(key.alias[0]=="$DEFAULT") d = random(key.greet)
			if (key.alias.includes(name)) {
				return random(key.greet)
			}
		}
		greetMessage.default=true
		// console.log("Greeted but name not found in config")
		return config.useDefault?d:""
	}

	function getRandomGreeting(cb) {
		let randomApi = getRandomApi()
		let url = random(randomApi.url)
		if (randomApi.urlReplaceRandom) {
			url = url.replace(randomApi.urlReplaceRandom, random(1 * 10 ** randomApi.urlReplaceDigits))
		}
		const options = {
			method: 'GET',
			encoding: 'UTF-8',
			json: true,
			headers: {
				'Accept': 'application/json'
			}
		}
		//console.log(url)
		request(url, options).then(res => {
			//console.log(res)
			return res.json()
		}).then(result => {
			let msg = result
			//console.log(result)
			if (randomApi.returnObjName) {
				for (let objname of randomApi.returnObjName) {
					if(objname == "@RANDOM") msg=random(msg)
					else msg = msg[objname]
				}
			}
			if (randomApi.nameReplace && msg.indexOf(randomApi.nameReplace) != -1) msg = msg.replace(randomApi.nameReplace, greetName)
			cb(msg)
		}).catch(e => {
			//console.log(e)
			errorCount++
			//console.log(`errorcount: ${errorCount}`)
			if (errorCount >= 3) {
				mod.log("too many errors getting random greeting, aborting")
				cb("")
				return
			}
			getRandomGreeting(cb)
		})
	}

	function getRandomApi() {
		let enabledApis = Object.keys(apis).filter(x => config.apis[x])
		let rnd = random(enabledApis)
		command.message(`Random greeting: ${rnd}`)
		return apis[rnd]
	}

	mod.game.on('leave_game', () => {
		players = {}
	})
	mod.game.on('enter_loading_screen', () => {
		players = {}
	})

	mod.hook('S_SPAWN_USER', 17, (event) => {
		let id = event.gameId
		players[id] = event
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
			let playerkeys = Object.keys(players).map(x => BigInt(x))
			event.targets = event.targets.filter(targ => playerkeys.includes(targ.gameId));
			// console.log(event.targets);

			let id = undefined
			// Assuming here the first target is always chosen
			if (event.targets.length > 0) {
				id = event.targets[0].gameId
				greetName = players[id].name
				// console.log('Name: ' + players[id].name);
				// console.log('Greet message: ' + greetMessage);
			} else {
				greetName = ""
			}
			greetMessage.text = getGreet(id)

			//console.log(greetName)
		}
	});

	//modify sent greeting message
	//modify sent greeting message
	mod.hook('C_CHAT', 1, (event) => {
		if (event.channel === 9) {
			if (greetMessage.text && !config.alwaysRandom) {
				if(greetMessage.default && !config.useDefault) return
				event.message = "<FONT>" + escapeHtml(greetMessage.text) + "</FONT>";
				greetMessage = {}
				return true;
			} else if (config.defaultRandom || config.alwaysRandom) {
				errorCount = 0
				getRandomGreeting(msg => {
					if (msg) event.message = "<FONT>" + escapeHtml(msg) + "</FONT>";
					mod.send('C_CHAT', 1, event)
				})
				return false
			}
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