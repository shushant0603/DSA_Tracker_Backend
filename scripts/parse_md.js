const fs = require('fs');
const path = require('path');

// Root directory where markdown files are
const ROOT_DIR = path.join(__dirname, '../../../');

const BOOKS = [
  { 
    file: 'DSA_Book_1_Linear_Foundations.md', 
    id: 'book-1',
    book: 'Book 1: Linear Foundations',
    shortTitle: 'Linear Foundations',
    icon: 'Layers',
    color: 'from-blue-500 to-indigo-600',
    description: 'Arrays, Strings, Hashing, Two Pointers, Sliding Window, Binary Search, Prefix Sum'
  },
  { 
    file: 'DSA_Book_2_Linked_Structures_Control_Flow.md', 
    id: 'book-2',
    book: 'Book 2: Linked Structures & Control Flow',
    shortTitle: 'Linked & Control Flow',
    icon: 'GitCommit',
    color: 'from-emerald-500 to-teal-600',
    description: 'Linked Lists, Stacks, Queues, Recursion, Backtracking'
  },
  { 
    file: 'DSA_Book_3_Hierarchical_Data_Structures.md', 
    id: 'book-3',
    book: 'Book 3: Hierarchical Data Structures',
    shortTitle: 'Trees & Heaps',
    icon: 'GitFork',
    color: 'from-amber-500 to-orange-600',
    description: 'Binary Trees, BST, Heap / Priority Queues, Tries'
  },
  { 
    file: 'DSA_Book_4_Graph_Algorithms.md', 
    id: 'book-4',
    book: 'Book 4: Graph Algorithms',
    shortTitle: 'Graph Algorithms',
    icon: 'Share2',
    color: 'from-rose-500 to-pink-600',
    description: 'Graph BFS/DFS, Topo Sort, Shortest Path (Dijkstra/Bellman), MST, DSU'
  },
  { 
    file: 'DSA_Book_5_Dynamic_Programming.md', 
    id: 'book-5',
    book: 'Book 5: Dynamic Programming',
    shortTitle: 'Dynamic Programming',
    icon: 'Cpu',
    color: 'from-purple-500 to-violet-600',
    description: '1D DP, 2D Grid DP, Knapsack, LIS, LCS, Tree DP, Graph DP'
  },
  { 
    file: 'ESSENTIAL_150_DSA.md', 
    id: 'essential-150',
    book: 'Essential 150: Placement Sheet',
    shortTitle: 'Essential 150',
    icon: 'Target',
    color: 'from-red-500 to-amber-600',
    description: 'Curated 150 high-frequency placement interview questions'
  },
  { 
    file: 'Binary_Search_Complete_Guide.md', 
    id: 'binary-search',
    book: 'Binary Search Complete Guide',
    shortTitle: 'Binary Search Master',
    icon: 'Search',
    color: 'from-cyan-500 to-blue-600',
    description: 'Exhaustive compendium of 300+ Binary Search patterns & variations'
  },
];

function parseMarkdown(filePath, bookInfo) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const questions = [];
  let currentChapter = 'General';
  let currentSection = 'General';
  const seenIds = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Chapter (# Chapter X: ... or # PART X: ... or ## Chapter X: ...)
    const chapterMatch = line.match(/^#+\s+(?:Chapter\s+\d+[:\s]+|PART\s+[IVXLCDM]+[:\s]+)(.+)/i) ||
                         line.match(/^#\s+(?:Chapter\s+\d+|PART\s+[IVXLCDM]+)[:\s]*(.*)/i);
    if (chapterMatch && !line.includes('Table of Contents')) {
      const matchText = (chapterMatch[1] || chapterMatch[0]).replace(/^#+\s*/, '').trim();
      if (matchText && !matchText.toLowerCase().includes('table of contents')) {
        currentChapter = matchText;
        currentSection = 'General';
        continue;
      }
    }

    // Detect Section (## X.Y ... or ### ...)
    const sectionMatch = line.match(/^##+\s+(\d+\.\d+[\s\w\W]*)/) || line.match(/^##+\s+([0-9A-Za-z\s\-_/&]+)/);
    if (sectionMatch && !line.startsWith('# Chapter') && !line.startsWith('# PART')) {
      const secText = sectionMatch[1].trim();
      if (!secText.toLowerCase().includes('table of contents') && !secText.toLowerCase().includes('progress tracker')) {
        currentSection = secText;
        continue;
      }
    }

    // Only process lines that look like table rows
    if (!line.startsWith('|')) continue;

    // Split into columns by |
    const cols = line.split('|').map(c => c.trim());
    if (cols.length < 3) continue;

    // Col 1 is usually ID or serial number
    const col1 = cols[1];
    let id = parseInt(col1);
    let title = '';
    let linkCol = '';
    let statusText = line;

    // For files like Binary Search where Col 1 is # (serial) and Col 2 is Problem Number (Leetcode ID)
    if (cols.length >= 4 && !isNaN(parseInt(cols[2])) && isNaN(parseInt(cols[1])) === false && parseInt(cols[1]) < 500 && parseInt(cols[2]) > 0) {
      // e.g. | 1 | 704 | Binary Search | ...
      id = parseInt(cols[2]);
      title = cols[3] || '';
      linkCol = cols[4] || '';
    } else {
      id = parseInt(col1);
      title = cols[2] || '';
      linkCol = cols[3] || '';
    }

    if (isNaN(id)) continue;
    if (!title || title.startsWith('---') || title.startsWith(':--') || title.toLowerCase() === 'problem' || title.toLowerCase() === 'problem title') continue;

    // Extract link
    let leetcodeUrl = null;
    const urlMatch = line.match(/https?:\/\/[^\s|)\]]+/);
    if (urlMatch) {
      leetcodeUrl = urlMatch[0].replace(/\/$/, '');
    } else {
      leetcodeUrl = `https://leetcode.com/problems/${id}`;
    }

    // Detect notes and status
    const isSolved = line.includes('✅');
    const isNeedRevision = line.includes('🧐') || /need revision/i.test(line);
    const isFailed = line.includes('❌');

    let status = 'unsolved';
    if (isSolved) status = 'solved';
    if (isNeedRevision) status = 'revision';
    if (isFailed) status = 'failed';

    let note = '';
    const noteMatch = line.match(/note:?->?\s*([^|;]+)/i) || line.match(/🧐:?-?\s*([^|;]+)/i) || line.match(/need revision/i);
    if (noteMatch) {
      note = noteMatch[1] ? noteMatch[1].trim() : noteMatch[0].trim();
    }

    // Clean title (remove markdown links, emojis, notes)
    let cleanTitle = title
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [Two Sum](url) -> Two Sum
      .replace(/✅.*$/g, '')
      .replace(/❌.*$/g, '')
      .replace(/🧐.*$/g, '')
      .replace(/\*\*/g, '')
      .replace(/need revision.*$/gi, '')
      .replace(/note:.*$/gi, '')
      .trim();

    if (!cleanTitle || cleanTitle.length < 2) continue;

    const uniqueKey = `${bookInfo.id}-${id}-${currentSection}`;
    if (seenIds.has(uniqueKey)) continue;
    seenIds.add(uniqueKey);

    questions.push({
      id,
      title: cleanTitle,
      book: bookInfo.book,
      bookId: bookInfo.id,
      chapter: currentChapter,
      section: currentSection,
      solved: isSolved,
      status: status,
      note: note,
      leetcodeUrl,
    });
  }

  return questions;
}

function main() {
  let allQuestions = [];
  let idCounter = 1;
  const booksSummary = [];

  for (const bookInfo of BOOKS) {
    const filePath = path.join(ROOT_DIR, bookInfo.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}`);
      continue;
    }
    console.log(`📖 Parsing: ${bookInfo.file}`);
    const questions = parseMarkdown(filePath, bookInfo);
    questions.forEach(q => { q._serial = idCounter++; });
    allQuestions = allQuestions.concat(questions);

    const solvedCount = questions.filter(q => q.solved).length;
    const chapters = [...new Set(questions.map(q => q.chapter))];

    booksSummary.push({
      id: bookInfo.id,
      name: bookInfo.book,
      shortTitle: bookInfo.shortTitle,
      icon: bookInfo.icon,
      color: bookInfo.color,
      description: bookInfo.description,
      totalQuestions: questions.length,
      solvedQuestions: solvedCount,
      chaptersCount: chapters.length,
      chapters: chapters.map(ch => ({
        name: ch,
        total: questions.filter(q => q.chapter === ch).length,
        solved: questions.filter(q => q.chapter === ch && q.solved).length,
        sections: [...new Set(questions.filter(q => q.chapter === ch).map(q => q.section))]
      }))
    });

    console.log(`   ✅ ${questions.length} questions, ${chapters.length} chapters extracted`);
  }

  const solved = allQuestions.filter(q => q.solved).length;
  const total = allQuestions.length;

  console.log(`\n📊 Total Questions: ${total} | Solved: ${solved}`);

  const outputPath = path.join(__dirname, '../data/questions.json');
  const metaOutputPath = path.join(__dirname, '../data/books_meta.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  
  fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2), 'utf8');
  fs.writeFileSync(metaOutputPath, JSON.stringify(booksSummary, null, 2), 'utf8');
  console.log(`✅ Saved questions to: ${outputPath}`);
  console.log(`✅ Saved books meta to: ${metaOutputPath}`);
}

main();
