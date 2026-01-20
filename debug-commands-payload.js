const { readdirSync } = require('fs');
const { join } = require('path');

async function analyzeCommands() {
  const commandsPath = join(__dirname, 'dist', 'commands');
  
  console.log('Commands path:', commandsPath);
  console.log('');
  
  const commandFiles = readdirSync(commandsPath).filter((file) => {
    const isValidExtension = file.endsWith('.ts') || file.endsWith('.js');
    const isNotMapFile = !file.endsWith('.map') && !file.endsWith('.d.ts');
    return isValidExtension && isNotMapFile;
  });

  console.log(`Found ${commandFiles.length} command files`);
  console.log('');

  const commands = [];
  const issues = [];

  for (const file of commandFiles) {
    try {
      const command = require(join(commandsPath, file));
      
      if (command.default?.data) {
        const cmdData = command.default.data;
        commands.push(cmdData);
        
        // Serialize to JSON to see what Discord will receive
        const serialized = JSON.stringify(cmdData);
        const jsonObj = JSON.parse(serialized);
        
        // Check various string fields
        if (jsonObj.name && jsonObj.name.length > 32) {
          issues.push({
            file,
            field: 'name',
            length: jsonObj.name.length,
            value: jsonObj.name
          });
        }
        
        if (jsonObj.description && jsonObj.description.length > 100) {
          issues.push({
            file,
            field: 'description',
            length: jsonObj.description.length,
            value: jsonObj.description
          });
        }
        
        // Check options
        if (jsonObj.options) {
          jsonObj.options.forEach((opt, idx) => {
            if (opt.name && opt.name.length > 32) {
              issues.push({
                file,
                field: `options[${idx}].name`,
                length: opt.name.length,
                value: opt.name
              });
            }
            if (opt.description && opt.description.length > 100) {
              issues.push({
                file,
                field: `options[${idx}].description`,
                length: opt.description.length,
                value: opt.description
              });
            }
            
            // Check choices
            if (opt.choices) {
              opt.choices.forEach((choice, choiceIdx) => {
                if (choice.name && choice.name.length > 100) {
                  issues.push({
                    file,
                    field: `options[${idx}].choices[${choiceIdx}].name`,
                    length: choice.name.length,
                    value: choice.name
                  });
                }
              });
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error loading ${file}:`, error.message);
    }
  }

  console.log(`\n=== ANALYSIS RESULTS ===\n`);
  console.log(`Total commands: ${commands.length}`);
  console.log(`Commands exceeding limits: ${issues.length}`);
  
  if (issues.length > 0) {
    console.log(`\n=== ISSUES FOUND ===\n`);
    issues.forEach(issue => {
      console.log(`File: ${issue.file}`);
      console.log(`Field: ${issue.field}`);
      console.log(`Length: ${issue.length} (limit: 100)`);
      console.log(`Value: "${issue.value}"`);
      console.log('---');
    });
  } else {
    console.log('\nNo issues found! All strings are within limits.');
  }
  
  // Calculate total payload size
  const payload = JSON.stringify(commands);
  console.log(`\nTotal payload size: ${payload.length} characters`);
  console.log(`Total payload size: ${(payload.length / 1024).toFixed(2)} KB`);
}

analyzeCommands().catch(console.error);
