const ENABLE_LOCAL_ADMIN = false;

const profile = {
  name: "Chris Portfolio",
  status: "Open for new builds",
  heroCopy: "A clean, editable portfolio for websites, game maps, experiments, and creative tech work.",
  currentFocus: "Websites + game maps",
  aboutTitle: "Creative technical portfolio",
  aboutText: "This portfolio is built to be simple to edit, easy to host, and flexible enough for websites, maps, experiments, and future creative work.",
  contactIntro: "Reach out through email, GitHub, or Discord for project and server work.",
  contactLinks: [
    { label: "Email", value: "chrisdesigningenterprises@gmail.com", href: "mailto:chrisdesigningenterprises@gmail.com" },
    { label: "GitHub", value: "ChrisDE7", href: "https://github.com/ChrisDE7" },
    { label: "Discord", value: "_7bush7", href: "discord://-/users/_7bush7" }
  ]
};

const projects = [
  {
    title: "First Website",
    monthYear: "Jun 2026",
    category: "Websites",
    shortDescription: "A starter website project.",
    longDescription: "A simple starter website project entry. Replace this with screenshots, real details, and links when your project is ready.",
    tags: ["HTML", "CSS", "JavaScript"],
    previewImage: "",
    previewGradient: "linear-gradient(135deg, #1fb85f, #f7d84a)",
    links: [
      { label: "Live Demo", url: "#" },
      { label: "Source", url: "#" }
    ]
  }
];

const maps = [
  {
    title: "Game Server Map",
    monthYear: "Jun 2026",
    game: "Unturned",
    category: "Unturned",
    status: "In progress",
    shortDescription: "A starter Unturned/game map project.",
    features: ["Spawn area", "Road layout", "Loot zones"],
    previewImage: "",
    previewGradient: "linear-gradient(135deg, #28e070, #f7d84a)",
    links: [
      { label: "Workshop", url: "#" },
      { label: "Preview", url: "#" }
    ]
  }
];

const skills = [
  {
    name: "Frontend",
    level: 78,
    description: "Clean responsive pages, polished UI states, accessible navigation, and small interactive touches.",
    tools: ["HTML", "CSS", "JavaScript"]
  },
  {
    name: "Game Maps",
    level: 100,
    description: "Map planning, layout flow, points of interest, progression routes, and server-ready presentation.",
    tools: ["Unturned", "World Layout", "Gameplay Flow"]
  },
  {
    name: "Design",
    level: 74,
    description: "Dark interface design, glass panels, strong spacing, readable cards, and portfolio-ready visuals.",
    tools: ["UI Design", "Responsive Layout", "Visual Polish"]
  }
];

