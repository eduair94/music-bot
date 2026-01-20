const fs = require('fs');
const path = require('path');

// Read all compiled JS files from dist/commands
const commandsPath = path.join(__dirname, 'dist', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => 
    file.endsWith('.js') && !file.endsWith('.map') && !file.endsWith('.d.ts')
);

console.log('Checking command descriptions...\n');

let foundLong = false;

function checkDescription(desc, type, commandName, path = '') {
    if (desc && desc.length > 110) {
        console.log(`❌ ${commandName}${path ? ` (${path})` : ''} - ${type}: ${desc.length} chars`);
        console.log(`   "${desc}"\n`);
        foundLong = true;
        return true;
    }
    return false;
}

function checkOptions(options, commandName, prefix = '') {
    if (!options) return;
    
    options.forEach((opt, index) => {
        const optPath = `${prefix}option[${index}]:${opt.name}`;
        checkDescription(opt.description, 'Option description', commandName, optPath);
        
        if (opt.choices) {
            opt.choices.forEach((choice, choiceIndex) => {
                const choicePath = `${optPath}.choice[${choiceIndex}]`;
                checkDescription(choice.name, 'Choice name', commandName, choicePath);
            });
        }
        
        if (opt.options) {
            checkOptions(opt.options, commandName, `${optPath}.`);
        }
    });
}

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        if (command.default?.data) {
            const data = command.default.data;
            const commandName = data.name;
            
            // Check command description
            checkDescription(data.description, 'Command description', commandName);
            
            // Check options
            if (data.options) {
                checkOptions(data.options, commandName);
            }
        }
    } catch (error) {
        console.log(`Error loading ${file}: ${error.message}`);
    }
}

if (!foundLong) {
    console.log('✅ No descriptions longer than 110 characters found!');
} else {
    console.log('\n⚠️  Found descriptions that exceed Discord\'s 110 character limit');
    process.exit(1);
}
