const fs = require('fs');
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// Read all compiled JS files from dist/commands
const commandsPath = path.join(__dirname, 'dist', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => 
    file.endsWith('.js') && !file.endsWith('.map') && !file.endsWith('.d.ts')
);

const commands = [];

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        if (command.default?.data) {
            commands.push(command.default.data);
        }
    } catch (error) {
        console.log(`Error loading ${file}: ${error.message}`);
    }
}

console.log(`Loaded ${commands.length} commands\n`);

// Test only the first command
const testCommand = commands[0];
console.log('Testing first command:', testCommand.name);

// Try to create a minimal REST instance and see if it validates
const rest = new REST({ version: "9" }).setToken('dummy_token');

try {
    // Discord's REST lib does validation before sending
    const body = commands.map(cmd => cmd.toJSON ? cmd.toJSON() : cmd);
    console.log(`\nSuccessfully converted ${body.length} commands to JSON`);
    console.log('\nFirst command JSON:');
    console.log(JSON.stringify(body[0], null, 2).substring(0, 500));
} catch (error) {
    console.error('\n❌ Error converting commands:', error.message);
    console.error(error);
}
