export const TERMS_GENERATION_PROMPT = (keywords: string[]) => `
Generate a professional Terms and Conditions document for **Evently** platform covering: ${keywords.join(', ')}.

Format the document with rich text compatible headings and lists:

# Introduction  
Evently provides services including ${keywords.join(', ')}. These terms govern all use of our platform.

## User Responsibilities  
You agree to:  
- Use ${keywords.length > 1 ? 'these services' : 'this service'} responsibly  
- Provide accurate information when using ${keywords.join(' or ')}  
- Comply with all Evently policies  

## Prohibited Actions  
When using Evently, you must NOT:  
- Misuse ${keywords.length > 1 ? 'any services' : 'the service'} for illegal activities  
- Bypass payment systems for ${keywords.includes('ticketing') ? 'tickets' : 'services'}  
- Harass other Evently users  

## Privacy Policy  
Evently collects data for:  
- ${keywords.includes('payments') ? 'Payment processing' : 'Service delivery'}  
- Account management  
- Platform improvements  

## Account Termination  
Evently may suspend accounts for:  
- Violating these terms  
- Abusing ${keywords.join(' or ')} functionality  
- Illegal activities  

**Formatting Requirements:**  
• Use clear hierarchy (Heading 1, Heading 2 styles)  
• Avoid code blocks or monospace text  
• Keep paragraphs under 4 lines  
• Highlight "Evently" in bold when referring to the platform  
• Ensure mobile-friendly readability  
`;