# IELTS Passage Text Formatting Guide

This guide explains how to format reading passages with rich text elements.

## Basic Formatting

### Bold Text

Use double asterisks for bold text:

```
**This text will be bold**
```

### Italic Text

Use single asterisks for italic text:

```
*This text will be italic*
```

## Size Formatting

### Large Text

Use `[large]` tags for larger, emphasized text:

```
[large]This is a large heading or important text[/large]
```

### Small Text

Use `[small]` tags for smaller, less emphasized text:

```
[small]This is small detail text[/small]
```

### Headings

Use `[heading]` tags for section headings:

```
[heading]Section Title[/heading]
```

## Images

### Adding Images

Use `[img:url]` to add images within the passage:

```
[img:https://example.com/passage-image.jpg]
```

The image will be automatically styled with:

- Responsive sizing (max-width: 100%)
- Rounded corners
- Border
- Proper spacing

## Example Usage

```
The life and work of Marie Curie

**Marie Curie** is probably the most famous woman scientist who has ever lived. Born *Maria Sklodowska* in Poland in 1867, she is famous for her work on radioactivity.

[large]Early Life and Education[/large]

From childhood, Marie was remarkable for her prodigious memory, and at the age of 16 won a gold medal on completion of her secondary education.

[img:https://example.com/marie-curie-lab.jpg]

[heading]Scientific Achievements[/heading]

With her husband, Pierre Curie, and Henri Becquerel, she was awarded the 1903 Nobel Prize for Physics. [small](She was the first woman to win a Nobel Prize.)[/small]
```

## Notes

- All formatting is automatically sanitized for security
- Images should be hosted on reliable servers
- Keep formatting simple and readable
- Text will automatically wrap into paragraphs
- Empty lines create paragraph breaks
