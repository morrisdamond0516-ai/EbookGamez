export const CATALOG_CATEGORIES = [
  {
    title: "Fiction (Story-Driven)",
    subcategories: [
      "Literary Fiction", "Science Fiction", "Fantasy", "Mystery / Thriller", 
      "Romance", "Horror", "Historical Fiction", "Adventure", 
      "Dystopian", "Young Adult Fiction", "Children's Fiction",
      "Cozy Fantasy"
    ]
  },
  {
    title: "Nonfiction (Information-Driven)",
    subcategories: [
      "Self-Help / Personal Development", "Business / Entrepreneurship", 
      "Finance / Investing", "Health & Wellness", "Psychology", "Productivity", 
      "Biographies & Memoirs", "History", "Black History", "Science & Technology", 
      "Philosophy", "Travel", "Parenting", "Education / Learning",
      "Relationships", "Nature & Environment", "Sociology"
    ]
  },
  {
    title: "Practical & How-To",
    subcategories: [
      "Guides & Manuals", "Cookbooks", "Workbooks", "Tutorials", 
      "DIY / Crafts", "Sports & Fitness", "Career Guides",
      "Fashion & Beauty"
    ]
  },
  {
    title: "Creative & Artistic",
    subcategories: [
      "Poetry", "Short Story Collections", "Photography Books", 
      "Art & Design", "Graphic Novels", "Comics",
      "Writing & Creativity", "Music", "Film & Cinema"
    ]
  },
  {
    title: "Spiritual & Inspirational",
    subcategories: [
      "Religion", "Spirituality", "Mindfulness", "Motivational", 
      "Manifestation / Law of Attraction"
    ]
  },
  {
    title: "Academic & Professional",
    subcategories: [
      "Textbooks", "Research Books", "Case Studies", "Technical Manuals", 
      "Reference Books"
    ]
  },
  {
    title: "Entertainment & Lifestyle",
    subcategories: [
      "Humor", "Pop Culture", "Home Décor", 
      "Food & Drink", "Gaming"
    ]
  },
  {
    title: "Hybrid Formats",
    subcategories: [
      "Journals", "Planners", "Prompt Books", "Coloring Books", 
      "Activity Books", "Quote Books"
    ]
  }
];

export interface Book {
  id: string;
  title: string;
  author: string;
  price: number;
  rating: number;
  cover: string;
  genre: string;
  category: string;
  subscriberExclusiveUntil?: string | null;
  coverFit?: "cover" | "contain";
}
