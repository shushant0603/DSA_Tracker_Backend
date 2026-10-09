const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

let cachedQuestions = null;
let cachedBooksMeta = null;

function getQuestions() {
  const filePath = path.join(__dirname, '../data/questions.json');
  if (!fs.existsSync(filePath)) return [];
  cachedQuestions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return cachedQuestions;
}

function getBooksMeta() {
  const filePath = path.join(__dirname, '../data/books_meta.json');
  if (!fs.existsSync(filePath)) return [];
  cachedBooksMeta = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return cachedBooksMeta;
}

// GET /api/questions/books -> All books with chapter summaries & stats
router.get('/books', (req, res) => {
  try {
    const meta = getBooksMeta();
    res.json(meta);
  } catch (err) {
    res.status(500).json({ message: 'Error loading books metadata', error: err.message });
  }
});

// GET /api/questions/book/:bookId -> Hierarchical structure of a specific book
router.get('/book/:bookId', (req, res) => {
  try {
    const { bookId } = req.params;
    const questions = getQuestions();
    const booksMeta = getBooksMeta();

    const bookMeta = booksMeta.find(b => b.id === bookId || b.name.toLowerCase().includes(bookId.toLowerCase()));
    
    // Filter questions for this book
    const bookQuestions = questions.filter(q => q.bookId === bookId || q.book === (bookMeta ? bookMeta.name : bookId));

    if (bookQuestions.length === 0) {
      return res.status(404).json({ message: 'Book not found or empty' });
    }

    // Group by chapter -> section -> questions
    const chaptersMap = new Map();

    for (const q of bookQuestions) {
      const chName = q.chapter || 'General';
      const secName = q.section || 'General';

      if (!chaptersMap.has(chName)) {
        chaptersMap.set(chName, new Map());
      }
      const sectionsMap = chaptersMap.get(chName);

      if (!sectionsMap.has(secName)) {
        sectionsMap.set(secName, []);
      }
      sectionsMap.get(secName).push(q);
    }

    const structuredChapters = [];
    chaptersMap.forEach((sectionsMap, chapterName) => {
      const sections = [];
      let chapterTotal = 0;
      let chapterSolved = 0;

      sectionsMap.forEach((qList, sectionName) => {
        chapterTotal += qList.length;
        chapterSolved += qList.filter(q => q.solved).length;
        sections.push({
          name: sectionName,
          total: qList.length,
          solved: qList.filter(q => q.solved).length,
          questions: qList,
        });
      });

      structuredChapters.push({
        name: chapterName,
        total: chapterTotal,
        solved: chapterSolved,
        sections,
      });
    });

    res.json({
      book: bookMeta || { id: bookId, name: bookQuestions[0].book },
      totalQuestions: bookQuestions.length,
      solvedQuestions: bookQuestions.filter(q => q.solved).length,
      chapters: structuredChapters,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error loading book data', error: err.message });
  }
});

// GET /api/questions/all
// Query params: book, bookId, chapter, section, solved, status, search, page, limit
router.get('/all', (req, res) => {
  try {
    let questions = getQuestions();

    const { book, bookId, chapter, section, solved, status, search, page = 1, limit = 50 } = req.query;

    if (bookId) {
      questions = questions.filter(q => q.bookId === bookId);
    } else if (book) {
      questions = questions.filter(q => q.book === book || (q.bookId && q.bookId.toLowerCase() === book.toLowerCase()));
    }
    if (chapter) {
      questions = questions.filter(q => q.chapter.toLowerCase().includes(chapter.toLowerCase()));
    }
    if (section) {
      questions = questions.filter(q => q.section.toLowerCase().includes(section.toLowerCase()));
    }
    if (status) {
      questions = questions.filter(q => q.status === status);
    }
    if (solved !== undefined && solved !== '') {
      questions = questions.filter(q => q.solved === (solved === 'true'));
    }
    if (search) {
      const s = search.toLowerCase();
      questions = questions.filter(q =>
        q.title.toLowerCase().includes(s) ||
        String(q.id).includes(s) ||
        q.section.toLowerCase().includes(s) ||
        q.chapter.toLowerCase().includes(s)
      );
    }

    const total = questions.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const paginated = limitNum === 0 ? questions : questions.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: limitNum === 0 ? 1 : Math.ceil(total / limitNum),
      questions: paginated,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error loading questions', error: err.message });
  }
});

// GET /api/questions/meta
router.get('/meta', (req, res) => {
  try {
    const questions = getQuestions();
    const books = [...new Set(questions.map(q => q.book))];
    const chapters = [...new Set(questions.map(q => q.chapter).filter(Boolean))];
    const totalSolved = questions.filter(q => q.solved).length;

    res.json({ books, chapters, total: questions.length, totalSolved });
  } catch (err) {
    res.status(500).json({ message: 'Error loading meta', error: err.message });
  }
});

// GET /api/questions/stats
router.get('/stats', (req, res) => {
  try {
    const questions = getQuestions();
    const stats = {};
    for (const q of questions) {
      const bKey = q.bookId || q.book;
      if (!stats[bKey]) stats[bKey] = { total: 0, solved: 0, name: q.book };
      stats[bKey].total++;
      if (q.solved) stats[bKey].solved++;
    }
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Error loading stats', error: err.message });
  }
});

module.exports = router;
