/**
 * Advanced Conflict & Complexity Detection
 * WHY THIS EXISTS: Catch problems before they reach production
 * Detects contradictions, scope mismatches, budget issues
 */

class ConflictDetector {
  constructor() {
    this.conflictTypes = {
      TIMELINE_SCOPE: 'timeline_scope',
      BUDGET_SCOPE: 'budget_scope',
      TECHNICAL_CONTRADICTION: 'technical_contradiction',
      RESOURCE_MISMATCH: 'resource_mismatch',
      EXPECTATION_REALITY: 'expectation_reality'
    };
  }

  /**
   * Detect all conflicts in a brief
   */
  detectConflicts(briefData, complexity = 'Pizza') {
    console.log('🔍 Running comprehensive conflict detection...');
    
    const conflicts = [];

    // 1. Timeline vs Scope conflicts
    conflicts.push(...this.detectTimelineConflicts(briefData, complexity));

    // 2. Budget vs Deliverables conflicts
    conflicts.push(...this.detectBudgetConflicts(briefData, complexity));

    // 3. Technical contradictions
    conflicts.push(...this.detectTechnicalConflicts(briefData));

    // 4. Resource mismatches
    conflicts.push(...this.detectResourceConflicts(briefData));

    // 5. Expectation vs Reality gaps
    conflicts.push(...this.detectExpectationConflicts(briefData, complexity));

    if (conflicts.length > 0) {
      console.log(`⚠️ Detected ${conflicts.length} conflicts:`);
      conflicts.forEach(c => console.log(`   - ${c.type}: ${c.severity}`));
    } else {
      console.log('✅ No conflicts detected');
    }

    return conflicts;
  }

  /**
   * Detect timeline vs scope conflicts
   */
  detectTimelineConflicts(briefData, complexity) {
    const conflicts = [];
    const briefText = JSON.stringify(briefData).toLowerCase();
    
    // Count scope indicators
    const scopeIndicators = [
      'photoshoot', 'shoot', 'filming',
      'editing', 'post-production',
      'motion graphics', 'animation',
      'color grading', 'sound design',
      'multiple formats', 'various platforms'
    ];
    
    const scopeCount = scopeIndicators.filter(ind => briefText.includes(ind)).length;
    
    // Detect urgent timeline
    const urgentIndicators = ['today', 'tomorrow', 'urgent', 'asap', '24 hour', 'immediate'];
    const isUrgent = urgentIndicators.some(ind => briefText.includes(ind));
    const daysAvailable = this.estimateDaysAvailable(briefData);
    
    // CONFLICT: Urgent timeline + complex scope
    if (isUrgent || (daysAvailable && daysAvailable <= 2)) {
      if (scopeCount >= 3) {
        conflicts.push({
          type: this.conflictTypes.TIMELINE_SCOPE,
          severity: 'high',
          description: `Timeline is ${isUrgent ? 'urgent' : `only ${daysAvailable} days`}, but scope includes ${scopeCount} production stages (photoshoot, editing, motion graphics, etc.). This is likely not feasible.`,
          recommendation: 'Urgent client conversation needed: Either extend timeline or reduce scope',
          impact: 'High risk of missed deadline or quality compromise'
        });
      } else if (scopeCount >= 2 && complexity === '3-Course Meal') {
        conflicts.push({
          type: this.conflictTypes.TIMELINE_SCOPE,
          severity: 'medium',
          description: `Complex project (${complexity}) with tight timeline and multi-stage production`,
          recommendation: 'Consider prioritizing must-have deliverables vs nice-to-haves',
          impact: 'Possible deadline pressure'
        });
      }
    }
    
    // CONFLICT: Long timeline but simple scope (might be overkill)
    if (daysAvailable && daysAvailable > 30 && scopeCount <= 1 && complexity === 'Cup of Tea') {
      conflicts.push({
        type: this.conflictTypes.EXPECTATION_REALITY,
        severity: 'low',
        description: `Simple ${complexity} project with ${daysAvailable}+ day timeline seems generous`,
        recommendation: 'Confirm if there are dependencies or milestones not mentioned',
        impact: 'Possible resource inefficiency'
      });
    }
    
    return conflicts;
  }

  /**
   * Detect budget vs scope conflicts
   */
  detectBudgetConflicts(briefData, complexity) {
    const conflicts = [];
    const briefText = JSON.stringify(briefData).toLowerCase();
    
    // Extract budget if mentioned
    const budgetMatch = briefText.match(/[£$€][\d,]+/);
    let budget = null;
    
    if (budgetMatch) {
      budget = parseInt(budgetMatch[0].replace(/[£$€,]/g, ''));
    }
    
    if (!budget) return conflicts; // Can't assess without budget
    
    // Count deliverable complexity
    const expensiveElements = [
      { term: 'photoshoot', cost: 1000, name: 'Professional photoshoot' },
      { term: 'video editing', cost: 800, name: 'Video editing' },
      { term: 'motion graphics', cost: 1200, name: 'Motion graphics' },
      { term: 'animation', cost: 1500, name: 'Animation' },
      { term: 'custom music', cost: 500, name: 'Custom music composition' },
      { term: 'color grading', cost: 400, name: 'Professional color grading' },
      { term: '3d', cost: 2000, name: '3D work' },
      { term: 'drone', cost: 600, name: 'Drone footage' }
    ];
    
    const requiredElements = expensiveElements.filter(el => briefText.includes(el.term));
    const estimatedCost = requiredElements.reduce((sum, el) => sum + el.cost, 0);
    
    // CONFLICT: Budget too low for scope
    if (estimatedCost > budget * 1.2) { // 20% buffer
      conflicts.push({
        type: this.conflictTypes.BUDGET_SCOPE,
        severity: 'high',
        description: `Budget is £${budget} but scope suggests ~£${estimatedCost} worth of work: ${requiredElements.map(e => e.name).join(', ')}`,
        recommendation: 'Critical: Scope needs to be reduced or budget increased significantly',
        impact: 'Project likely unprofitable or undeliverable at current budget'
      });
    } else if (estimatedCost > budget) {
      conflicts.push({
        type: this.conflictTypes.BUDGET_SCOPE,
        severity: 'medium',
        description: `Budget (£${budget}) is tight for requested scope (est. £${estimatedCost})`,
        recommendation: 'Review scope priorities with client - some elements may need to be optional',
        impact: 'Thin margins - monitor costs closely'
      });
    }
    
    // CONFLICT: Budget too high for simple scope
    if (budget > 5000 && complexity === 'Cup of Tea' && requiredElements.length <= 1) {
      conflicts.push({
        type: this.conflictTypes.EXPECTATION_REALITY,
        severity: 'low',
        description: `Simple ${complexity} project with £${budget} budget seems generous`,
        recommendation: 'Confirm scope - client may expect more than currently specified',
        impact: 'Possible scope creep risk if expectations unclear'
      });
    }
    
    return conflicts;
  }

  /**
   * Detect technical contradictions
   */
  detectTechnicalConflicts(briefData) {
    const conflicts = [];
    const briefText = JSON.stringify(briefData);
    
    // Duration contradictions
    const durationMatches = briefText.match(/(\d+)\s*(?:second|sec|s\b)/gi);
    if (durationMatches && durationMatches.length > 1) {
      const durations = durationMatches.map(m => parseInt(m.match(/\d+/)[0]));
      const unique = [...new Set(durations)];
      
      if (unique.length > 1) {
        conflicts.push({
          type: this.conflictTypes.TECHNICAL_CONTRADICTION,
          severity: 'medium',
          description: `Multiple different durations mentioned: ${unique.join('s, ')}s`,
          recommendation: 'Clarify: Which duration is correct?',
          impact: 'Freelancer confusion - may deliver wrong length'
        });
      }
    }
    
    // Aspect ratio contradictions
    const hasVertical = /vertical|9:16|1080x1920/i.test(briefText);
    const hasHorizontal = /horizontal|16:9|1920x1080/i.test(briefText);
    const hasSquare = /square|1:1|1080x1080/i.test(briefText);
    
    const aspectRatios = [hasVertical, hasHorizontal, hasSquare].filter(Boolean).length;
    
    if (aspectRatios > 1) {
      conflicts.push({
        type: this.conflictTypes.TECHNICAL_CONTRADICTION,
        severity: 'medium',
        description: 'Multiple aspect ratios mentioned (vertical, horizontal, square)',
        recommendation: 'Clarify: Are multiple formats needed, or is one primary?',
        impact: 'May require additional deliverables not accounted for in timeline/budget'
      });
    }
    
    return conflicts;
  }

  /**
   * Detect resource mismatch conflicts
   */
  detectResourceConflicts(briefData) {
    const conflicts = [];
    const briefText = JSON.stringify(briefData).toLowerCase();
    
    // Check for specialized skills mentioned
    const specializedSkills = [
      '3d animation', 'vfx', 'visual effects', 'compositing',
      'advanced color grading', 'cinema camera', 'red camera',
      'sound design', 'audio mixing', 'original score'
    ];
    
    const requiresSpecialist = specializedSkills.some(skill => briefText.includes(skill));
    const seemsSimple = briefText.includes('simple') || briefText.includes('basic') || briefText.includes('quick');
    
    if (requiresSpecialist && seemsSimple) {
      conflicts.push({
        type: this.conflictTypes.RESOURCE_MISMATCH,
        severity: 'medium',
        description: 'Brief mentions specialized skills (3D, VFX, etc.) but also describes project as "simple" or "quick"',
        recommendation: 'Confirm complexity level - specialized work typically not "simple"',
        impact: 'Possible misalignment on project complexity'
      });
    }
    
    return conflicts;
  }

  /**
   * Detect expectation vs reality gaps
   */
  detectExpectationConflicts(briefData, complexity) {
    const conflicts = [];
    const briefText = JSON.stringify(briefData).toLowerCase();
    
    // Premium expectations with basic budget
    const premiumTerms = ['luxury', 'high-end', 'premium', 'exclusive', 'cinema', 'commercial grade'];
    const hasPremiumExpectations = premiumTerms.some(term => briefText.includes(term));
    
    const budgetMatch = briefText.match(/[£$€][\d,]+/);
    const budget = budgetMatch ? parseInt(budgetMatch[0].replace(/[£$€,]/g, '')) : null;
    
    if (hasPremiumExpectations && budget && budget < 3000) {
      conflicts.push({
        type: this.conflictTypes.EXPECTATION_REALITY,
        severity: 'medium',
        description: `Client uses premium language (${premiumTerms.filter(t => briefText.includes(t)).join(', ')}) but budget is under £3k`,
        recommendation: 'Set expectations: Premium aesthetics typically require higher investment',
        impact: 'Client satisfaction risk if expectations not aligned with budget reality'
      });
    }
    
    return conflicts;
  }

  /**
   * Estimate days available based on deadline
   */
  estimateDaysAvailable(briefData) {
    const briefText = JSON.stringify(briefData).toLowerCase();
    
    if (briefText.includes('today') || briefText.includes('immediate')) return 0;
    if (briefText.includes('tomorrow')) return 1;
    if (briefText.includes('this week')) return 3;
    if (briefText.includes('next week')) return 7;
    if (briefText.includes('two weeks')) return 14;
    if (briefText.includes('month')) return 30;
    
    // Check for actual dates
    const dateMatch = briefData.Due_Dates || briefData.deadline || briefData['Due Dates'];
    if (dateMatch) {
      try {
        const dueDate = new Date(dateMatch);
        const now = new Date();
        const diffTime = Math.abs(dueDate - now);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      } catch (e) {
        return null;
      }
    }
    
    return null;
  }
}

module.exports = ConflictDetector;

