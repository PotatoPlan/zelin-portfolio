export interface SocialLink {
  label: string;
  handle: string;
  url: string;
  platform: 'instagram' | 'unsplash' | 'behance' | 'linkedin' | 'github' | 'x' | 'email';
  description?: string;
}

export const siteConfig = {
  title: 'Shu Zelin — Visual Storyteller & Technologist',
  name: 'Shu Zelin',
  role: 'Photographer · Visual Storyteller · Creative Technologist',
  tagline: 'Capturing quiet geometry, kinetic motion, and atmospheric light across cities and circuits.',
  location: 'Melbourne, Australia',
  availability: {
    status: 'Available for select shoots & creative collaborations',
    available: true,
  },
  shortBio:
    'Motorsport photography trackside and in the paddock.',
  fullBio: [
    'What started as carrying a compact camera on late-night walks evolved into a dedicated pursuit of light, pace, and narrative structure.',
    'Whether tracking high-speed machinery trackside, waiting for a solitary silhouette in an urban canyon, or building digital products by day, my focus remains the same: intentional framing and honest detail.',
  ],
  stats: [
    { label: 'Photo Series', value: '12+' },
    { label: 'Cities Documented', value: '9' },
    { label: 'Years Shooting', value: '5+' },
    { label: 'Print & Digital Editions', value: '24' },
  ],
  portfolioDownload: {
    enabled: true,
    title: 'Selected Works & Creative Lookbook (PDF)',
    subtitle:
      'A curated offline edition featuring high-impact spreads, project notes, exhibition history, and full CV for clients, agencies, and editors.',
    fileUrl: 'files/portfolio-lookbook.pdf',
    fileName: 'Shu-Zelin-Portfolio-Lookbook.pdf',
    fileSize: '4.2 MB',
    updatedAt: 'November 2026',
    highlights: [
      '28 curated plates across Street, Motorsport & Architecture',
      'Series narratives, technical camera notes & lighting breakdowns',
      'Condensed career timeline, exhibitions & contact sheet',
    ],
  },
  gearAndSkills: {
    camerasAndOptics: [
      'Full-Frame Mirrorless Body',
      '35mm f/1.4 Prime (Street & Documentary)',
      '85mm f/1.8 Prime (Portrait & Detail)',
      '70–200mm f/2.8 Telephoto (Motorsport & Compression)',
    ],
    disciplines: [
      'Street & Urban Documentary',
      'Motorsport & Panning Action',
      'Architectural Minimalism',
      'Editorial Color Grading & Print Prep',
    ],
    creativeTech: [
      'Lightroom Classic & Capture One',
      'TypeScript / Astro / React',
      'Interactive Web Typography & Motion',
      'Cloud & Edge Architecture (Azure / Cloudflare)',
    ],
  },
  socials: [
    {
      label: 'Instagram',
      handle: '@zelin.frames',
      url: 'https://instagram.com/',
      platform: 'instagram',
      description: 'Ongoing visual diary, behind-the-scenes reels, and recent street frames.',
    },
    {
      label: 'Behance / Prints',
      handle: 'behance.net/zelinshu',
      url: 'https://behance.net/',
      platform: 'behance',
      description: 'Full editorial layout spreads and curated design case studies.',
    },
    {
      label: 'Unsplash',
      handle: 'unsplash.com/@zelin',
      url: 'https://unsplash.com/',
      platform: 'unsplash',
      description: 'Open-license atmospheric wallpapers and architectural studies.',
    },
    {
      label: 'LinkedIn',
      handle: 'in/zelinshu',
      url: 'https://linkedin.com/',
      platform: 'linkedin',
      description: 'Professional background, engineering roles, and industry network.',
    },
    {
      label: 'GitHub',
      handle: 'github.com/zelinshu',
      url: 'https://github.com/',
      platform: 'github',
      description: 'Open-source experiments, creative coding, and web projects.',
    },
    {
      label: 'Email',
      handle: 'hello@example.com',
      url: 'mailto:hello@example.com',
      platform: 'email',
      description: 'Direct inquiries for prints, commissions, licensing, or coffee.',
    },
  ] satisfies SocialLink[],
  navLinks: [
    { label: 'Home', href: '/' },
    { label: 'Portfolio', href: '/gallery' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
};
