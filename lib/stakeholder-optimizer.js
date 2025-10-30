/**
 * Stakeholder-Optimized Content Generation
 * WHY THIS EXISTS: Same brief needs to serve 3 different audiences
 * - Freelancer: Needs technical specs to execute
 * - Client: Needs to see their vision reflected
 * - Manager: Needs to see risks and scope
 */

class StakeholderOptimizer {
  constructor() {
    this.stakeholders = ['freelancer', 'client', 'manager'];
  }

  /**
   * Optimize content for all stakeholders simultaneously
   */
  optimizeContent(sectionName, rawContent, briefData) {
    const optimized = {
      core: rawContent, // Base content everyone sees
      freelancerEnhancements: [],
      clientEnhancements: [],
      managerEnhancements: []
    };

    // Determine section type
    const sectionType = this.identifySectionType(sectionName);

    switch(sectionType) {
      case 'technical':
        return this.optimizeTechnicalSection(rawContent, briefData);
      case 'creative':
        return this.optimizeCreativeSection(rawContent, briefData);
      case 'logistics':
        return this.optimizeLogisticsSection(rawContent, briefData);
      case 'budget':
        return this.optimizeBudgetSection(rawContent, briefData);
      default:
        return optimized;
    }
  }

  /**
   * Identify what type of section this is
   */
  identifySectionType(sectionName) {
    const normalized = sectionName.toLowerCase();
    
    if (normalized.includes('technical') || normalized.includes('specifications') || normalized.includes('format')) {
      return 'technical';
    }
    if (normalized.includes('creative') || normalized.includes('aesthetic') || normalized.includes('style')) {
      return 'creative';
    }
    if (normalized.includes('production') || normalized.includes('logistics') || normalized.includes('timeline')) {
      return 'logistics';
    }
    if (normalized.includes('budget') || normalized.includes('scope')) {
      return 'budget';
    }
    return 'general';
  }

  /**
   * Optimize technical sections
   */
  optimizeTechnicalSection(content, briefData) {
    return {
      core: content,
      freelancerEnhancements: [
        {
          type: 'technical_checklist',
          title: '🔧 Production Checklist',
          items: this.generateTechnicalChecklist(content, briefData)
        }
      ],
      clientEnhancements: [
        {
          type: 'plain_language_summary',
          title: '📝 What This Means',
          content: this.translateToClientLanguage(content)
        }
      ],
      managerEnhancements: [
        {
          type: 'risk_assessment',
          title: '⚠️ Technical Considerations',
          items: this.identifyTechnicalRisks(content, briefData)
        }
      ]
    };
  }

  /**
   * Optimize creative sections
   */
  optimizeCreativeSection(content, briefData) {
    return {
      core: content,
      freelancerEnhancements: [
        {
          type: 'execution_notes',
          title: '🎨 Creative Execution Notes',
          content: 'Maintain client\'s described aesthetic while ensuring technical delivery standards'
        }
      ],
      clientEnhancements: [
        {
          type: 'vision_confirmation',
          title: '✨ Your Vision',
          content: this.extractClientLanguage(content)
        }
      ],
      managerEnhancements: [
        {
          type: 'scope_clarity',
          title: '📊 Creative Scope',
          content: this.assessCreativeScope(content)
        }
      ]
    };
  }

  /**
   * Optimize logistics sections
   */
  optimizeLogisticsSection(content, briefData) {
    return {
      core: content,
      freelancerEnhancements: [
        {
          type: 'workflow_breakdown',
          title: '📋 Workflow Steps',
          items: this.generateWorkflowSteps(content)
        }
      ],
      clientEnhancements: [], // Logistics less relevant to client view
      managerEnhancements: [
        {
          type: 'resource_requirements',
          title: '👥 Resource Planning',
          content: this.assessResourceNeeds(content, briefData)
        },
        {
          type: 'timeline_feasibility',
          title: '⏱️ Timeline Assessment',
          content: this.assessTimelineFeasibility(content, briefData)
        }
      ]
    };
  }

  /**
   * Optimize budget sections
   */
  optimizeBudgetSection(content, briefData) {
    return {
      core: content,
      freelancerEnhancements: [], // Budget less relevant to freelancer initially
      clientEnhancements: [
        {
          type: 'value_breakdown',
          title: '💰 Investment Breakdown',
          content: this.explainBudgetValue(content)
        }
      ],
      managerEnhancements: [
        {
          type: 'budget_risk_analysis',
          title: '⚠️ Budget vs Scope Analysis',
          items: this.analyzeBudgetRisks(content, briefData)
        },
        {
          type: 'margin_assessment',
          title: '📊 Margin & Profitability',
          content: this.assessMargins(content)
        }
      ]
    };
  }

  // ===== HELPER METHODS =====

  generateTechnicalChecklist(content, briefData) {
    // Extract technical requirements and convert to checklist
    const items = [];
    if (content.includes('1080') || content.includes('resolution')) {
      items.push('Verify export resolution meets specs');
    }
    if (content.includes('format') || content.includes('MP4')) {
      items.push('Confirm file format compatibility');
    }
    if (content.includes('vertical') || content.includes('9:16')) {
      items.push('Set correct aspect ratio for delivery');
    }
    return items.length > 0 ? items : ['Review all technical specifications before starting'];
  }

  translateToClientLanguage(content) {
    // Simplify technical jargon for clients
    let translated = content;
    translated = translated.replace(/1080x1920px/gi, 'HD vertical format');
    translated = translated.replace(/9:16/gi, 'vertical (optimized for mobile)');
    translated = translated.replace(/MP4/gi, 'standard video format');
    translated = translated.replace(/codec/gi, 'video compression');
    return translated || 'Technical specifications optimized for your target platforms';
  }

  identifyTechnicalRisks(content, briefData) {
    const risks = [];
    if (content.includes('4K') || content.includes('3840')) {
      risks.push('⚠️ 4K delivery increases file size and render time');
    }
    if (content.includes('multiple formats')) {
      risks.push('📦 Multiple format delivery requires additional QA time');
    }
    return risks.length > 0 ? risks : ['✅ Standard technical requirements - no unusual risks'];
  }

  extractClientLanguage(content) {
    // Find descriptive, non-technical language that reflects client's vision
    const descriptors = [];
    const clientWords = ['moody', 'elevated', 'premium', 'minimal', 'bold', 'elegant', 'vibrant', 'clean'];
    
    for (const word of clientWords) {
      if (content.toLowerCase().includes(word)) {
        descriptors.push(word);
      }
    }
    
    return descriptors.length > 0 
      ? `Your vision: ${descriptors.join(', ')} aesthetic`
      : content;
  }

  assessCreativeScope(content) {
    if (content.length > 500) {
      return '📊 Detailed creative brief - requires dedicated creative review';
    } else if (content.length > 200) {
      return '📊 Standard creative scope - clear direction provided';
    } else {
      return '📊 Minimal creative direction - may need creative discovery';
    }
  }

  generateWorkflowSteps(content) {
    // Basic workflow extraction - can be enhanced
    return [
      'Review all requirements and confirm understanding',
      'Gather necessary assets and resources',
      'Execute production per specifications',
      'Deliver for review per timeline'
    ];
  }

  assessResourceNeeds(content, briefData) {
    const needs = [];
    if (content.toLowerCase().includes('photoshoot')) {
      needs.push('📸 Photography resources required');
    }
    if (content.toLowerCase().includes('editing')) {
      needs.push('✂️ Video editing resources required');
    }
    if (content.toLowerCase().includes('motion graphics')) {
      needs.push('🎬 Motion design resources required');
    }
    return needs.length > 0 
      ? needs.join(', ')
      : 'Standard production resources';
  }

  assessTimelineFeasibility(content, briefData) {
    const urgency = briefData.urgency_score || 0;
    const hasComplexScope = content.toLowerCase().includes('photoshoot') && 
                            content.toLowerCase().includes('editing');
    
    if (urgency >= 7 && hasComplexScope) {
      return '⚠️ HIGH ALERT: Urgent timeline + complex scope = resource strain';
    } else if (urgency >= 7) {
      return '⏰ Urgent timeline - prioritize accordingly';
    } else if (hasComplexScope) {
      return '📅 Complex scope - ensure adequate timeline buffer';
    } else {
      return '✅ Timeline appears feasible';
    }
  }

  analyzeBudgetRisks(content, briefData) {
    const risks = [];
    const budgetText = content.toLowerCase();
    
    if (budgetText.includes('tight') || budgetText.includes('limited')) {
      risks.push('⚠️ Budget constraints may limit scope');
    }
    if (budgetText.includes('photoshoot') && budgetText.includes('£2')) {
      risks.push('🚨 Photoshoot + £2k budget = very tight margins');
    }
    
    return risks.length > 0 ? risks : ['✅ Budget appears appropriate for scope'];
  }

  explainBudgetValue(content) {
    return 'Your investment covers production, creative direction, editing, and delivery of final assets';
  }

  assessMargins(content) {
    // Placeholder - would integrate with actual cost data
    return '📊 Standard margin profile - monitor production costs closely';
  }

  /**
   * Generate stakeholder-specific callouts for a section
   */
  generateStakeholderCallouts(optimizedContent) {
    const callouts = [];

    // Freelancer callouts
    if (optimizedContent.freelancerEnhancements && optimizedContent.freelancerEnhancements.length > 0) {
      for (const enhancement of optimizedContent.freelancerEnhancements) {
        if (enhancement.items && enhancement.items.length > 0) {
          callouts.push({
            audience: 'freelancer',
            emoji: '🔧',
            title: enhancement.title,
            items: enhancement.items
          });
        }
      }
    }

    // Manager callouts
    if (optimizedContent.managerEnhancements && optimizedContent.managerEnhancements.length > 0) {
      for (const enhancement of optimizedContent.managerEnhancements) {
        if (enhancement.items && enhancement.items.length > 0) {
          callouts.push({
            audience: 'manager',
            emoji: '⚠️',
            title: enhancement.title,
            items: enhancement.items,
            color: 'yellow_background'
          });
        } else if (enhancement.content) {
          callouts.push({
            audience: 'manager',
            emoji: '📊',
            title: enhancement.title,
            content: enhancement.content,
            color: 'gray_background'
          });
        }
      }
    }

    return callouts;
  }
}

module.exports = StakeholderOptimizer;

