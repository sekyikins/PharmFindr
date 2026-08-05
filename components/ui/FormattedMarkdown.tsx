import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';

interface FormattedMarkdownProps {
  content: string;
  textColor?: string;
}

/**
 * Parses markdown formatting (**bold**, # Headers, * Bullet points, 1. Lists)
 * into styled React Native native components without showing raw symbols.
 */
export function FormattedMarkdown({ content, textColor }: FormattedMarkdownProps) {
  const { theme, primaryColor } = useThemeContext();
  const color = textColor || theme.text.primary;

  // Split into lines
  const lines = (content || '').split('\n');

  return (
    <View style={styles.container}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={lineIdx} style={{ height: 6 }} />;
        }

        // 0. Horizontal Rule / Divider (e.g. ---, ***, ___)
        const isDivider = /^[-*_]{3,}$/.test(trimmed);
        if (isDivider) {
          return (
            <View
              key={lineIdx}
              style={[styles.hr, { backgroundColor: theme.border || '#e5e7eb' }]}
            />
          );
        }

        // 1. Headers (# Header or ## Subheader)
        if (trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^#+\s*/, '');
          return (
            <Text key={lineIdx} style={[styles.header, { color }]}>
              {renderInlineStyles(headerText, color)}
            </Text>
          );
        }

        // 2. Bullet list items (* Item or - Item)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const bulletText = trimmed.substring(2);
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: primaryColor }]}>•</Text>
              <Text style={[styles.bulletText, { color }]}>
                {renderInlineStyles(bulletText, color)}
              </Text>
            </View>
          );
        }

        // 3. Numbered list items (e.g., 1. Item)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          const num = numMatch[1];
          const numText = numMatch[2];
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.numDot, { color: primaryColor }]}>{num}.</Text>
              <Text style={[styles.bulletText, { color }]}>
                {renderInlineStyles(numText, color)}
              </Text>
            </View>
          );
        }

        // 4. Normal paragraph text
        return (
          <Text key={lineIdx} style={[styles.paragraph, { color }]}>
            {renderInlineStyles(trimmed, color)}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * Parses inline formatting like **bold** and *italic* inside a line.
 */
function renderInlineStyles(text: string, defaultColor: string) {
  // Regex to match **bold** or *italic*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <Text key={index} style={styles.boldText}>
          {boldText}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const italicText = part.slice(1, -1);
      return (
        <Text key={index} style={styles.italicText}>
          {italicText}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  header: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 20,
    marginRight: 6,
    fontWeight: '700',
  },
  numDot: {
    fontSize: 13,
    lineHeight: 20,
    marginRight: 6,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 2,
  },
  boldText: {
    fontWeight: '700',
  },
  italicText: {
    fontStyle: 'italic',
  },
  hr: {
    height: 1,
    width: '100%',
    marginVertical: 8,
  },
});
