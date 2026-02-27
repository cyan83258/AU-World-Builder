# AU World Builder

SillyTavern extension that automatically generates Alternate Universe (AU) world settings and character profiles based on the current chat's {{char}} and {{user}} profiles.

## Features

### 1. AU World Generation
- Automatically references {{char}} and {{user}} profiles from the current chat
- Generates AU world settings (Overview) and character adaptations
- User inputs desired AU concept (e.g., "Dystopian Fantasy SF world", "Vampire fantasy world")
- Click generate button to create complete world and character settings

### 2. Automatic Prompt Injection
- Generated world and character settings are automatically injected as input for chat generation
- Stories are written within the AU world context automatically

### 3. Separate World & Character Management
- World Setting (Overview) displayed and saved separately
- Character Settings for {{char}} and {{user}} displayed separately
- Clothing Styles for each character displayed separately
- All sections are viewable and editable by the user

### 4. Auto-Update & Manual Update
- **Auto-Update**: Automatically updates world and character settings as the story progresses
  - Configurable update interval (every N messages)
  - Can be toggled on/off
- **Manual Update**: Specify message range (e.g., #3 to #6) to update based on specific story sections

### 5. Custom API Connection
- Select specific API connection profile for this extension
- Supports SillyTavern's Connection Manager profiles
- Custom API option (OpenAI-compatible endpoints)
- API connection test button included

### 6. Genre & Tone Prompt
- Generates appropriate genre and tone prompts based on the AU world
- Example: For a noir AU, generates "Write in noir, hard-boiled, slice of life, romance genre. Maintain dark tone."
- Toggle to enable/disable injection with each message

### 7. Output Format
All content is generated in English with the following structure:

```
#World Setting
(2 paragraphs describing the AU world)

---
#Character Settings
##{{char}}
(2 paragraphs about character's AU adaptation)

##{{user}}
(2 paragraphs about user's AU adaptation)

#Character Clothing Styles
##{{char}}'s style
(2 paragraphs describing character's clothing)

##{{user}}'s style
(2 paragraphs describing user's clothing)
```

## Installation

1. Copy the `AU-World-Builder` folder to your SillyTavern extensions directory:
   - `data/default-user/extensions/` (for user-specific installation)
   - or `scripts/extensions/third-party/` (for global installation)

2. Refresh SillyTavern

3. The extension will appear in the Extensions menu as "AU World Builder"

## Usage

1. Open a chat with a character
2. Click the Extensions menu (puzzle piece icon)
3. Select "AU World Builder"
4. Enter your AU concept in the text box
5. Click "Generate AU World"
6. Edit the generated content as needed
7. Enable "Enable AU World Injection" to include settings in chat generation

## Tips

- Be specific with your AU concept for better results
- You can manually edit any generated section
- Use the Preview Injection button to see exactly what will be sent to the AI
- Export your AU data to reuse it later or share with others
- The Genre Prompt feature helps maintain consistent writing style

## Requirements

- SillyTavern 1.12.0 or higher
- Working API connection (any supported by SillyTavern)

## Version

1.0.0 - Initial release
