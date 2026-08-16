import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, SPACING } from '@/styles/theme';

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
  const color = textColor || theme.text;

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
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          return <View key={lineIdx} style={[styles.divider, { backgroundColor: theme.border }]} />;
        }

        // 1. Headers (### or ## or #)
        if (trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^#+\s*/, '');
          return (
            <Text key={lineIdx} style={[styles.header, { color }]}>
              {renderFormattedText(headerText, primaryColor)}
            </Text>
          );
        }

        // 2. Unordered Bullet Point (* or -)
        if (/^[*|-]\s+/.test(trimmed)) {
          const bulletText = trimmed.replace(/^[*|-]\s+/, '');
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: primaryColor }]}>•</Text>
              <Text style={[styles.bulletText, { color }]}>
                {renderFormattedText(bulletText, primaryColor)}
              </Text>
            </View>
          );
        }

        // 3. Ordered List (1. 2. 3.)
        const matchNumber = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (matchNumber) {
          const num = matchNumber[1];
          const listText = matchNumber[2];
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.numDot, { color: primaryColor }]}>{num}.</Text>
              <Text style={[styles.bulletText, { color }]}>
                {renderFormattedText(listText, primaryColor)}
              </Text>
            </View>
          );
        }

        // 4. Regular Paragraph
        return (
          <Text key={lineIdx} style={[styles.paragraph, { color }]}>
            {renderFormattedText(trimmed, primaryColor)}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * Helper to render inline **bold** and *italic* formatting
 */
function renderFormattedText(text: string, accentColor: string) {
  // Regex to split by **bold** or *italic*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={styles.boldText}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <Text key={index} style={styles.italicText}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return part;
  });
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  divider: {
    height: 1,
    marginVertical: SPACING.xs,
  },
  header: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
    marginTop: 6,
    marginBottom: SPACING.xs,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: FONT_SIZE.xl,
    lineHeight: 20,
    marginRight: 6,
    fontFamily: 'Inter-Bold',
  },
  numDot: {
    fontSize: FONT_SIZE.md,
    lineHeight: 20,
    marginRight: 6,
    fontFamily: 'Inter-Bold',
  },
  bulletText: {
    fontFamily: 'Inter-Regular',
    flex: 1,
    fontSize: FONT_SIZE.lg,
    lineHeight: 20,
  },
  paragraph: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.lg,
    lineHeight: 20,
    marginVertical: 2,
  },
  boldText: {
    fontFamily: 'Inter-Bold',
  },
  italicText: {
    fontStyle: 'italic',
  },
});
