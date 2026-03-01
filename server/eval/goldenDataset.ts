import type { UserFilters, RawEvent } from '../agents/state'

export interface EvalInput {
  userQuery: string
  userFilters: UserFilters
  rawEvents: RawEvent[]
}

export interface EvalExpectedOutput {
  relevantHeuristicCategories: string[]
  expectedPassTitles: string[]
  expectedRejectTitles: string[]
  groundTruthReasoning: string
}

export interface EvalItem {
  input: EvalInput
  expectedOutput: EvalExpectedOutput
}

const futureDate = '2026-03-14'
const futureDate2 = '2026-03-21'

export const goldenDataset: EvalItem[] = [
  // 1. Alcohol filter — brewery venue
  {
    input: {
      userQuery: 'Find weekend events in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: true,
        familyFriendly: false,
        secular: false,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Live Jazz at Zilker Brewing',
          description: 'Enjoy live jazz with craft beers on tap. Free entry.',
          date: futureDate,
          url: 'https://example.com/jazz-brewery',
          source: 'eventbrite',
          venue: 'Zilker Brewing Company',
          city: 'Austin',
        },
        {
          title: 'Saturday Morning Yoga in the Park',
          description: 'Free community yoga class at Zilker Park. Bring your own mat.',
          date: futureDate,
          url: 'https://example.com/yoga-park',
          source: 'eventbrite',
          venue: 'Zilker Park',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['alcohol', 'general'],
      expectedPassTitles: ['Saturday Morning Yoga in the Park'],
      expectedRejectTitles: ['Live Jazz at Zilker Brewing'],
      groundTruthReasoning:
        'The brewery event is at an alcohol-focused venue and mentions craft beers. The yoga class is at a public park with no alcohol involvement.',
    },
  },

  // 2. Alcohol filter — wine tasting disguised as art event
  {
    input: {
      userQuery: 'Art events this weekend in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: true,
        familyFriendly: false,
        secular: false,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Paint & Sip Night',
          description: 'Paint your masterpiece while enjoying complimentary wine. All supplies included.',
          date: futureDate,
          url: 'https://example.com/paint-sip',
          source: 'eventbrite',
          venue: 'The Artful Pour',
          city: 'Austin',
        },
        {
          title: 'Community Mural Painting',
          description: 'Help paint a new community mural downtown. No experience necessary.',
          date: futureDate,
          url: 'https://example.com/mural',
          source: 'eventbrite',
          venue: 'Congress Avenue',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['alcohol', 'general'],
      expectedPassTitles: ['Community Mural Painting'],
      expectedRejectTitles: ['Paint & Sip Night'],
      groundTruthReasoning:
        'Paint & Sip explicitly includes wine and the venue name suggests alcohol focus. The mural painting is a public outdoor activity with no alcohol.',
    },
  },

  // 3. Religious/secular filter — church community event
  {
    input: {
      userQuery: 'Community events in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: false,
        familyFriendly: false,
        secular: true,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Community Pancake Breakfast',
          description: 'Free pancake breakfast for the whole community. Everyone welcome! Hosted by First Baptist Church.',
          date: futureDate,
          url: 'https://example.com/pancakes',
          source: 'eventbrite',
          venue: 'First Baptist Church of Austin',
          city: 'Austin',
        },
        {
          title: 'Austin Makers Market',
          description: 'Local artisans showcase handmade goods. Live music and food trucks.',
          date: futureDate,
          url: 'https://example.com/makers',
          source: 'eventbrite',
          venue: 'Palmer Events Center',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['religious', 'general'],
      expectedPassTitles: ['Austin Makers Market'],
      expectedRejectTitles: ['Community Pancake Breakfast'],
      groundTruthReasoning:
        'The pancake breakfast is hosted by and held at a Baptist church — a religious organization. The makers market is at a secular venue with no religious affiliation.',
    },
  },

  // 4. Secular filter — holiday event with religious undertones
  {
    input: {
      userQuery: 'Holiday events in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: false,
        familyFriendly: false,
        secular: true,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Christmas Nativity Walk',
          description: 'Walk through live nativity scenes depicting the birth of Jesus. Carols and hot cocoa provided.',
          date: futureDate,
          url: 'https://example.com/nativity',
          source: 'eventbrite',
          venue: 'St. Marys Cathedral',
          city: 'Austin',
        },
        {
          title: 'Winter Lights Festival',
          description: 'Thousands of holiday lights, food vendors, ice skating, and live entertainment.',
          date: futureDate,
          url: 'https://example.com/lights',
          source: 'eventbrite',
          venue: 'Trail of Lights at Zilker Park',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['religious', 'general'],
      expectedPassTitles: ['Winter Lights Festival'],
      expectedRejectTitles: ['Christmas Nativity Walk'],
      groundTruthReasoning:
        'The nativity walk is explicitly religious (depicting Jesus, at a cathedral). The lights festival is a secular seasonal celebration at a public park.',
    },
  },

  // 5. Political filter — partisan fundraiser
  {
    input: {
      userQuery: 'Networking events this week in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: false,
        familyFriendly: false,
        secular: false,
        apolitical: true,
      },
      rawEvents: [
        {
          title: 'Young Democrats Mixer',
          description: 'Network with fellow progressive professionals. Fundraiser for local Democratic candidates.',
          date: futureDate,
          url: 'https://example.com/dem-mixer',
          source: 'eventbrite',
          venue: 'The Roosevelt Room',
          city: 'Austin',
        },
        {
          title: 'Austin Tech Happy Hour',
          description: 'Casual networking for Austin tech professionals. Drinks and appetizers provided.',
          date: futureDate,
          url: 'https://example.com/tech-hh',
          source: 'eventbrite',
          venue: 'Capital Factory',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['political', 'general'],
      expectedPassTitles: ['Austin Tech Happy Hour'],
      expectedRejectTitles: ['Young Democrats Mixer'],
      groundTruthReasoning:
        'The Democrats mixer is explicitly partisan and a political fundraiser. The tech happy hour is an industry networking event with no political affiliation.',
    },
  },

  // 6. Cost filter — hidden fees
  {
    input: {
      userQuery: 'Free things to do in Austin',
      userFilters: {
        city: 'Austin',
        free: true,
        noAlcohol: false,
        familyFriendly: false,
        secular: false,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Free Outdoor Movie Night',
          description: 'Watch a classic film under the stars. Free admission. $5 suggested donation for popcorn.',
          date: futureDate,
          url: 'https://example.com/movie',
          source: 'eventbrite',
          venue: 'Republic Square',
          city: 'Austin',
        },
        {
          title: 'Art Museum Free Day',
          description: 'Enjoy free admission to the Blanton Museum of Art. No reservations needed.',
          date: futureDate,
          url: 'https://example.com/museum',
          source: 'eventbrite',
          venue: 'Blanton Museum of Art',
          city: 'Austin',
        },
        {
          title: 'Yoga & Brunch Workshop',
          description: 'Free yoga session followed by a brunch. Brunch ticket is $25.',
          date: futureDate,
          url: 'https://example.com/yoga-brunch',
          source: 'eventbrite',
          venue: 'South Congress Hotel',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['cost', 'general'],
      expectedPassTitles: ['Art Museum Free Day'],
      expectedRejectTitles: ['Free Outdoor Movie Night', 'Yoga & Brunch Workshop'],
      groundTruthReasoning:
        'The museum free day is genuinely free. The movie night has a suggested donation which creates social pressure to pay. The yoga/brunch bundles a $25 charge making it not genuinely free.',
    },
  },

  // 7. Family-friendly filter — adult venue
  {
    input: {
      userQuery: 'Family things to do this weekend in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: false,
        familyFriendly: true,
        secular: false,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Kids Science Discovery Day',
          description: 'Hands-on science experiments for kids ages 5-12. Parents welcome.',
          date: futureDate,
          url: 'https://example.com/science',
          source: 'eventbrite',
          venue: 'Thinkery Childrens Museum',
          city: 'Austin',
        },
        {
          title: 'Stand-Up Comedy Night',
          description: 'Uncensored comedy featuring adult humor. Two-drink minimum. Ages 21+ only.',
          date: futureDate,
          url: 'https://example.com/comedy',
          source: 'eventbrite',
          venue: 'Vulcan Gas Company',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['family', 'general'],
      expectedPassTitles: ['Kids Science Discovery Day'],
      expectedRejectTitles: ['Stand-Up Comedy Night'],
      groundTruthReasoning:
        'The science day is at a children\'s museum and designed for kids. The comedy night is 21+, uncensored, and at a bar venue.',
    },
  },

  // 8. Multi-filter: free + secular + family-friendly
  {
    input: {
      userQuery: 'Free family events in Austin',
      userFilters: {
        city: 'Austin',
        free: true,
        noAlcohol: false,
        familyFriendly: true,
        secular: true,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Storytime at the Library',
          description: 'Free storytime for children ages 3-8. Crafts and snacks included.',
          date: futureDate,
          url: 'https://example.com/storytime',
          source: 'eventbrite',
          venue: 'Austin Public Library',
          city: 'Austin',
        },
        {
          title: 'Vacation Bible School',
          description: 'Free week-long Bible school for kids. Games, songs, and scripture lessons.',
          date: futureDate,
          url: 'https://example.com/vbs',
          source: 'eventbrite',
          venue: 'Grace Covenant Church',
          city: 'Austin',
        },
        {
          title: 'Kids Cooking Class',
          description: 'Learn to make pasta from scratch. $15 materials fee per child.',
          date: futureDate,
          url: 'https://example.com/cooking',
          source: 'eventbrite',
          venue: 'Sur La Table',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['cost', 'family', 'religious', 'general'],
      expectedPassTitles: ['Storytime at the Library'],
      expectedRejectTitles: ['Vacation Bible School', 'Kids Cooking Class'],
      groundTruthReasoning:
        'Library storytime is free, family-friendly, and secular. Vacation Bible School is religious. Cooking class has a $15 fee.',
    },
  },

  // 9. Multi-filter: alcohol-free + apolitical
  {
    input: {
      userQuery: 'Social events in Austin this week',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: true,
        familyFriendly: false,
        secular: false,
        apolitical: true,
      },
      rawEvents: [
        {
          title: 'Board Game Cafe Night',
          description: 'Play hundreds of board games. Coffee, tea, and snacks available. No alcohol served.',
          date: futureDate,
          url: 'https://example.com/boardgames',
          source: 'eventbrite',
          venue: 'Emerald Tavern Games & Cafe',
          city: 'Austin',
        },
        {
          title: 'GOP Gala Dinner',
          description: 'Annual Republican Party fundraiser dinner with keynote speaker. Open bar included.',
          date: futureDate,
          url: 'https://example.com/gop-gala',
          source: 'eventbrite',
          venue: 'Driskill Hotel',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['alcohol', 'political', 'general'],
      expectedPassTitles: ['Board Game Cafe Night'],
      expectedRejectTitles: ['GOP Gala Dinner'],
      groundTruthReasoning:
        'Board game cafe serves no alcohol and is non-political. The GOP gala is both partisan (Republican fundraiser) and includes an open bar.',
    },
  },

  // 10. Edge case: ambiguous venue name with "bar" but not actually a bar
  {
    input: {
      userQuery: 'Fitness events in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: true,
        familyFriendly: false,
        secular: false,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Barre Fitness Class',
          description: 'High-energy barre workout combining ballet, pilates, and strength training.',
          date: futureDate,
          url: 'https://example.com/barre',
          source: 'eventbrite',
          venue: 'Pure Barre South Lamar',
          city: 'Austin',
        },
        {
          title: 'Pub Run Club',
          description: 'Weekly 5K run ending at a local pub for post-run beers. All paces welcome.',
          date: futureDate,
          url: 'https://example.com/pub-run',
          source: 'eventbrite',
          venue: 'Easy Tiger Patio',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['alcohol', 'general'],
      expectedPassTitles: ['Barre Fitness Class'],
      expectedRejectTitles: ['Pub Run Club'],
      groundTruthReasoning:
        'Barre is a fitness studio despite "barre" sounding like "bar." The pub run explicitly ends at a pub for beers, centering alcohol in the social component.',
    },
  },

  // 11. Cost filter — "pay what you can" ambiguity
  {
    input: {
      userQuery: 'Free concerts in Austin',
      userFilters: {
        city: 'Austin',
        free: true,
        noAlcohol: false,
        familyFriendly: false,
        secular: false,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Blues on the Green',
          description: 'Free outdoor concert series at Zilker Park. No tickets required.',
          date: futureDate,
          url: 'https://example.com/blues-green',
          source: 'eventbrite',
          venue: 'Zilker Park',
          city: 'Austin',
        },
        {
          title: 'Acoustic Sessions',
          description: 'Intimate acoustic performances. Pay-what-you-can admission, minimum $10.',
          date: futureDate,
          url: 'https://example.com/acoustic',
          source: 'eventbrite',
          venue: 'Cactus Cafe',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['cost', 'general'],
      expectedPassTitles: ['Blues on the Green'],
      expectedRejectTitles: ['Acoustic Sessions'],
      groundTruthReasoning:
        'Blues on the Green is genuinely free with no tickets needed. Acoustic Sessions has a $10 minimum despite "pay-what-you-can" framing.',
    },
  },

  // 12. Family filter — event at a family venue but late night
  {
    input: {
      userQuery: 'Events at parks this weekend in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: false,
        familyFriendly: true,
        secular: false,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Kite Festival',
          description: 'Annual kite festival with kite-making workshops, food, and live music for all ages.',
          date: futureDate,
          time: '10:00 AM',
          url: 'https://example.com/kites',
          source: 'eventbrite',
          venue: 'Zilker Park',
          city: 'Austin',
        },
        {
          title: 'Full Moon Rave',
          description: 'All-night electronic music festival. Ages 18+. Glow paint and fire dancers.',
          date: futureDate,
          time: '10:00 PM',
          url: 'https://example.com/rave',
          source: 'eventbrite',
          venue: 'Zilker Park',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['family', 'general'],
      expectedPassTitles: ['Kite Festival'],
      expectedRejectTitles: ['Full Moon Rave'],
      groundTruthReasoning:
        'Kite festival is explicitly for all ages with family activities. The rave is 18+, late night, and not appropriate for children.',
    },
  },

  // 13. All filters active simultaneously
  {
    input: {
      userQuery: 'Things to do in Austin',
      userFilters: {
        city: 'Austin',
        free: true,
        noAlcohol: true,
        familyFriendly: true,
        secular: true,
        apolitical: true,
      },
      rawEvents: [
        {
          title: 'Public Library Book Fair',
          description: 'Free book giveaway and reading activities for all ages at the Austin Public Library.',
          date: futureDate2,
          url: 'https://example.com/bookfair',
          source: 'eventbrite',
          venue: 'Austin Central Library',
          city: 'Austin',
        },
        {
          title: 'Church BBQ & Campaign Rally',
          description: 'Free BBQ hosted by First Methodist. Local candidates will speak. Beer garden available.',
          date: futureDate2,
          url: 'https://example.com/church-rally',
          source: 'eventbrite',
          venue: 'First Methodist Church',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['cost', 'alcohol', 'family', 'religious', 'political', 'general'],
      expectedPassTitles: ['Public Library Book Fair'],
      expectedRejectTitles: ['Church BBQ & Campaign Rally'],
      groundTruthReasoning:
        'The library book fair is free, alcohol-free, family-friendly, secular, and apolitical. The church BBQ fails on religious (church venue), political (campaign rally), and alcohol (beer garden) filters.',
    },
  },

  // 14. Secular filter — meditation/mindfulness (borderline)
  {
    input: {
      userQuery: 'Wellness events in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: false,
        familyFriendly: false,
        secular: true,
        apolitical: false,
      },
      rawEvents: [
        {
          title: 'Mindfulness Meditation Workshop',
          description: 'Science-based mindfulness techniques for stress reduction. Led by a licensed therapist.',
          date: futureDate,
          url: 'https://example.com/mindfulness',
          source: 'eventbrite',
          venue: 'Austin Wellness Center',
          city: 'Austin',
        },
        {
          title: 'Kirtan & Devotional Chanting',
          description: 'Join us for an evening of sacred chanting and spiritual connection. Led by Swami Prakash.',
          date: futureDate,
          url: 'https://example.com/kirtan',
          source: 'eventbrite',
          venue: 'Austin Yoga Shala',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['religious', 'general'],
      expectedPassTitles: ['Mindfulness Meditation Workshop'],
      expectedRejectTitles: ['Kirtan & Devotional Chanting'],
      groundTruthReasoning:
        'The mindfulness workshop is science-based and led by a therapist — secular wellness. Kirtan is explicitly devotional/sacred chanting with spiritual goals.',
    },
  },

  // 15. Political filter — civic vs partisan (nuanced)
  {
    input: {
      userQuery: 'Community meetings in Austin',
      userFilters: {
        city: 'Austin',
        free: false,
        noAlcohol: false,
        familyFriendly: false,
        secular: false,
        apolitical: true,
      },
      rawEvents: [
        {
          title: 'City Council Public Hearing',
          description: 'Public hearing on proposed zoning changes. All residents welcome to provide testimony.',
          date: futureDate,
          url: 'https://example.com/city-council',
          source: 'eventbrite',
          venue: 'Austin City Hall',
          city: 'Austin',
        },
        {
          title: 'Progressive Action Network Rally',
          description: 'Rally to support progressive policies on healthcare and climate. Speakers include local activists.',
          date: futureDate,
          url: 'https://example.com/progressive-rally',
          source: 'eventbrite',
          venue: 'Republic Square',
          city: 'Austin',
        },
      ],
    },
    expectedOutput: {
      relevantHeuristicCategories: ['political', 'general'],
      expectedPassTitles: ['City Council Public Hearing'],
      expectedRejectTitles: ['Progressive Action Network Rally'],
      groundTruthReasoning:
        'A city council hearing is non-partisan civic engagement open to all viewpoints. The progressive rally is explicitly partisan advocacy for specific political positions.',
    },
  },
]
