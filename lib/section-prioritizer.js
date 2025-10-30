/**
 * Dynamic Section Prioritization
 * WHY THIS EXISTS: Reorders template sections based on what matters most in THIS brief
 * Adapts structure to urgency, budget constraints, novel content types
 */

class SectionPrioritizer {
  constructor() {
    this.defaultPriorities = {
      'Raw Brief': 100,
      'Brief Details': 90,
      'Key Details': 80,
      'Technical Specifications': 70,
      'Creative Direction': 60,
      'Production & Logistics': 50,
      'Notes & Considerations': 40,
      'Additional Information': 10
    };
  }

  /**
   * Calculate section priorities based on brief context
   */
  prioritizeSections(sections, briefData, urgencyScore = 0, conflicts = []) {
    console.log('🎯 Calculating dynamic section priorities...');
    
    const priorities = [];
    
    for (const section of sections) {
      let priority = this.getBasePriority(section.heading);
      let reasoning = [];

      // URGENCY BOOST
      if (urgencyScore >= 7) {
        if (this.isUrgencyRelevant(section.heading)) {
          priority += 30;
          reasoning.push('Urgency-critical section');
        }
      }

      // CONFLICT BOOST
      if (conflicts.length > 0) {
        if (this.isConflictRelevant(section.heading, conflicts)) {
          priority += 20;
          reasoning.push('Contains flagged conflicts');
        }
      }

      // BUDGET CONSTRAINT BOOST
      if (this.detectsBudgetConstraint(briefData)) {
        if (this.isBudgetRelevant(section.heading)) {
          priority += 25;
          reasoning.push('Budget-sensitive section');
        }
      }

      // NOVEL CONTENT BOOST (new content type not in standard template)
      if (this.isNovelContent(section)) {
        priority += 15;
        reasoning.push('Novel content type requiring attention');
      }

      priorities.push({
        section: section.heading,
        priority,
        reasoning: reasoning.join(', ') || 'Standard priority'
      });
    }

    // Sort by priority descending
    priorities.sort((a, b) => b.priority - a.priority);

    console.log('✅ Section priorities calculated:');
    priorities.slice(0, 5).forEach(p => {
      console.log(`   ${p.section}: ${p.priority} (${p.reasoning})`);
    });

    return priorities;
  }

  /**
   * Get base priority for a section
   */
  getBasePriority(sectionHeading) {
    const normalized = sectionHeading.toLowerCase()
      .replace(/[📝📋🎥⚙️🎨📦🎬📎]/g, '')
      .trim();

    for (const [key, priority] of Object.entries(this.defaultPriorities)) {
      if (normalized.includes(key.toLowerCase())) {
        return priority;
      }
    }

    return 50; // Default mid-priority
  }

  /**
   * Check if section is urgency-relevant
   */
  isUrgencyRelevant(heading) {
    const urgencyKeywords = ['deadline', 'timeline', 'delivery', 'critical', 'requirements', 'key details'];
    const normalized = heading.toLowerCase();
    return urgencyKeywords.some(kw => normalized.includes(kw));
  }

  /**
   * Check if section relates to flagged conflicts
   */
  isConflictRelevant(heading, conflicts) {
    const normalized = heading.toLowerCase();
    return conflicts.some(conflict => {
      const conflictType = conflict.type.toLowerCase();
      return normalized.includes('budget') && conflictType.includes('budget') ||
             normalized.includes('timeline') && conflictType.includes('timeline') ||
             normalized.includes('scope') && conflictType.includes('scope');
    });
  }

  /**
   * Detect if brief has budget constraints
   */
  detectsBudgetConstraint(briefData) {
    const briefText = JSON.stringify(briefData).toLowerCase();
    return briefText.includes('budget') && 
           (briefText.includes('limited') || 
            briefText.includes('tight') || 
            briefText.includes('constraint') ||
            briefText.includes('only £') ||
            briefText.includes('only $'));
  }

  /**
   * Check if section is budget-relevant
   */
  isBudgetRelevant(heading) {
    const normalized = heading.toLowerCase();
    return normalized.includes('budget') || 
           normalized.includes('scope') || 
           normalized.includes('deliverable') ||
           normalized.includes('production');
  }

  /**
   * Check if this is a novel content section (not in standard templates)
   */
  isNovelContent(section) {
    // If section was dynamically created (not from template), it's novel
    return section.isGenerated || false;
  }

  /**
   * Identify if brief requires new sections not in template
   */
  identifyNovelSections(briefData, existingTemplateSections) {
    console.log('🔍 Checking for novel content types...');
    
    const novelSections = [];
    const briefText = JSON.stringify(briefData).toLowerCase();

    // Check for emerging content types
    const emergingTypes = [
      { keywords: ['nft', 'web3', 'blockchain', 'crypto'], sectionName: '🌐 Web3 & Blockchain Requirements' },
      { keywords: ['ar', 'augmented reality', 'ar filter'], sectionName: '🥽 AR/XR Requirements' },
      { keywords: ['ai generated', 'midjourney', 'dall-e', 'generative'], sectionName: '🤖 AI-Generated Content Specs' },
      { keywords: ['podcast', 'audio series', 'voice'], sectionName: '🎙️ Audio Production Requirements' },
      { keywords: ['livestream', 'live stream', 'streaming'], sectionName: '📡 Live Streaming Requirements' },
      { keywords: ['ugc', 'user generated content', 'creator content'], sectionName: '👥 UGC Content Guidelines' }
    ];

    for (const type of emergingTypes) {
      const hasKeywords = type.keywords.some(kw => briefText.includes(kw));
      const alreadyExists = existingTemplateSections.some(s => 
        s.toLowerCase().includes(type.sectionName.toLowerCase().replace(/[🌐🥽🤖🎙️📡👥]/g, '').trim())
      );

      if (hasKeywords && !alreadyExists) {
        novelSections.push({
          name: type.sectionName,
          reason: `Brief mentions ${type.keywords[0]} content`,
          priority: 75 // High priority for novel content
        });
        console.log(`   ✨ Novel section identified: ${type.sectionName}`);
      }
    }

    return novelSections;
  }
}

module.exports = SectionPrioritizer;

