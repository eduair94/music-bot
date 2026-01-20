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
            commands.push(command.default.data);
        }
    } catch (error) {
        console.log(`Error loading ${file}: ${error.message}`);
    }
}

// Check the first command in detail
if (commands.length > 0) {
    const firstCommand = commands[0];
    console.log('\nFirst command:', firstCommand.name);
    console.log('Description:', firstCommand.description, '(length:', firstCommand.description?.length || 0, ')');
    
    if (firstCommand.options) {
        console.log('\nOptions:');
        firstCommand.options.forEach((opt, i) => {
            console.log(`  [${i}] ${opt.name}: "${opt.description}" (${opt.description?.length || 0} chars)`);
            if (opt.options) {
                opt.options.forEach((subOpt, j) => {
                    console.log(`    [${j}] ${subOpt.name}: "${subOpt.description}" (${subOpt.description?.length || 0} chars)`);
                    if (subOpt.options) {
                        subOpt.options.forEach((subSubOpt, k) => {
                            console.log(`      [${k}] ${subSubOpt.name}: "${subSubOpt.description}" (${subSubOpt.description?.length || 0} chars)`);
                        });
                    }
                });
            }
        });
    }
}

// Output the JSON to see structure
fs.writeFileSync('commands-debug.json', JSON.stringify(commands, null, 2));
console.log('\n✅ Written commands to commands-debug.json');
console.log(`Total commands: ${commands.length}`);
