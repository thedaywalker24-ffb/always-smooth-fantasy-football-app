const LEAGUE_RULES = {
  title: "Always Smooth Constitution '26",
  sourceUrl: 'https://docs.google.com/document/d/1Ekdl6QntwVpZQg_gyjiTab3Hv1RgsXXYjVC9PYSRmNM/edit',
  sections: [
    {
      title: 'Welcome & Weekly Betting',
      blocks: [
        {
          type: 'paragraph',
          text: 'Welcome to the Always Smooth League presented by Keystone Light®. The goal is to keep dynasty football fun for the entire league through weekly side games and end-of-season awards.'
        },
        {
          type: 'paragraph',
          text: 'Every week, the commissioner posts 6 predictions in the Always Smooth App. Picks must be submitted before kickoff of the first NFL game of the week. Weekly prizes are funded from the league buy-in pot.'
        },
        { type: 'heading', text: 'How to place your bets' },
        {
          type: 'list',
          items: [
            'Open the Always Smooth App.',
            'Choose the Betting tab.',
            'Choose your name.',
            'Enter all 6 predictions.',
            'Press Submit Picks to save.'
          ]
        },
        {
          type: 'paragraph',
          text: 'The member with the most correct picks wins the weekly parlay. Ties are decided by the tiebreaker. During championship week, the weekly parlay prize is doubled.'
        },
        {
          type: 'paragraph',
          text: 'The Most Total Bets Won award goes to the member with the most correct individual bets for the season. Weekly parlay wins and tiebreaker answers do not determine this award.'
        }
      ]
    },
    {
      title: 'The Monies',
      blocks: [
        {
          type: 'list',
          items: [
            'Buy-in: $100',
            'Weekly parlay: $20',
            'Most Total Bets Won award: $50',
            'League Champion: $350',
            'Runner-up: $175',
            'Sacko / Toilet Bowl loser: chugs a beer at the next season draft'
          ]
        }
      ]
    },
    {
      title: 'Champion Rules',
      blocks: [
        { type: 'heading', text: 'The Wreckoning' },
        {
          type: 'paragraph',
          text: 'The playoff champion may add, update, or remove one league rule. The change must be within reason and should not make the rest of the league rage.'
        },
        {
          type: 'paragraph',
          text: 'Example: adjust the interception penalty for quarterbacks or add an IDP roster position.'
        },
        { type: 'heading', text: 'Current champion rules in effect' },
        {
          type: 'list',
          items: [
            'Mulligan (Kelli): Once per season, each member may swap a benched or Taxi player for a starter after scores settle. It cannot be used during the playoffs, and the commissioner must be notified.',
            'Loser Chugs (Cole): The lowest-scoring team each week submits a video of them chugging a beer. If teams tie for the lowest score, all tied teams submit a video.',
            'Turkeys for Turkeys (Travis): A starting player who scores 0 or fewer points gives the team one strike. Every third strike requires the team to submit a video taking a shot of Wild Turkey. Bench and other non-starting players do not count.',
            'Team Captain (Zach): Each team may select one current starter as Captain each week. The Captain earns 2× points, which the commissioner manually applies in Sleeper. A player may only be used once per season, and the selection may be changed while submissions remain open.'
          ]
        },
        { type: 'heading', text: 'The Sacko Expansion Draft' },
        {
          type: 'paragraph',
          text: 'The Sacko matchup winner chooses one of the two benefits below, and the loser receives the other benefit.'
        },
        {
          type: 'list',
          items: [
            'A one-for-one player trade to the champion’s team. The league must approve that the two players have similar value. Before the decision, the champion lists four untouchable players.',
            'The first overall pick in the following season’s rookie draft. Draft-pick trading can affect which picks are available.'
          ]
        }
      ]
    },
    {
      title: 'Rookie Draft',
      blocks: [
        {
          type: 'paragraph',
          text: 'Starting with Season 2 (2023), teams are retained from year to year and the league holds a 3-round, rookies-only draft. It is linear—not a snake draft—and draft picks may be traded like players.'
        },
        { type: 'heading', text: 'Draft order' },
        {
          type: 'list',
          items: [
            'Picks 9 and 10: the league champion receives pick 10, and the runner-up receives pick 9.',
            'Picks 1 and 2: determined by The Sacko Expansion Draft.',
            'All other picks: placement-game winners receive the higher of the two picks associated with their matchup.',
            'Example: the winner of the third-place matchup receives pick 7, and the loser receives pick 8.'
          ]
        }
      ]
    },
    {
      title: 'Dynasty Tips',
      blocks: [
        {
          type: 'list',
          items: [
            'Base roster decisions on the future of your team, not only the current season.',
            'Player age should factor into long-term decisions.',
            'Wide receivers often retain value longer than running backs because running backs generally have shorter careers.',
            'Quarterbacks also tend to have more productive seasons than running backs.'
          ]
        }
      ]
    },
    {
      title: 'Playoffs',
      blocks: [
        {
          type: 'paragraph',
          text: 'The top 6 teams make the playoffs beginning in Week 15. The bracket reseeds every round, so the highest remaining seed plays the lowest remaining seed.'
        },
        {
          type: 'paragraph',
          text: 'The bottom 4 teams compete in the Toilet Bowl.'
        }
      ]
    },
    {
      title: 'Off-season & Other Rules',
      blocks: [
        {
          type: 'paragraph',
          text: 'Teams carry over during the off-season. Members may initiate trades for the following season and may trade upcoming draft picks.'
        },
        {
          type: 'paragraph',
          text: 'Off-season free-agent acquisitions may also be available, but this remains unconfirmed in the current constitution.'
        },
        {
          type: 'paragraph',
          text: 'Trade deadline: the end of Week 11 is the final point to submit in-season trades.'
        },
        { type: 'heading', text: 'Taxi Squad' },
        {
          type: 'paragraph',
          text: 'Rookies may be held on the Taxi Squad without occupying a normal roster spot, but they cannot enter the starting lineup. A Taxi player may be promoted to playable status, but cannot return to the Taxi Squad after the regular season begins.'
        }
      ]
    }
  ]
};
