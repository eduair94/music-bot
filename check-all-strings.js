const fs = require('fs');
const path = require('path');

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
            // Convert to JSON like Discord.js does
            const jsonData = command.default.data.toJSON ? command.default.data.toJSON() : command.default.data;
            commands.push(jsonData);
        }
    } catch (error) {
        console.log(`Error loading ${file}: ${error.message}`);
    }
}

console.log(`Loaded ${commands.length} commands\n`);

// Check all fields
function checkAllStrings(obj, path = '', commandName = '') {
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string' && value.length > 110) {
            console.log(`❌ [${commandName}] ${currentPath}: ${value.length} chars`);
            console.log(`   "${value}"\n`);
        } else if (Array.isArray(value)) {
            value.forEach((item, i) => {
                if (typeof item === 'object' && item !== null) {
                    checkAllStrings(item, `${currentPath}[${i}]`, commandName);
                } else if (typeof item === 'string' && item.length > 110) {
                    console.log(`❌ [${commandName}] ${currentPath}[${i}]: ${item.length} chars`);
                    console.log(`   "${item}"\n`);
                }
            });
        } else if (typeof value === 'object' && value !== null) {
            checkAllStrings(value, currentPath, commandName);
        }
    }
}

commands.forEach((cmd, index) => {
    checkAllStrings(cmd, '', cmd.name || `Command ${index}`);
});

console.log('✅ Check complete!');
