/**
 * Intelligent Processor - Phase 3 Meta-Cognitive Layer (Minimal)
 * 
 * WHY THIS EXISTS:
 * - Pre-flight sanity checks (backend only)
 * - Automatic complexity re-classification
 * - Silent smart defaults
 * - Natural language conflict detection (client-friendly)
 * 
 * PRINCIPLE: Smart backend, clean frontend. No technical jargon on Notion pages.
 */

class IntelligentProcessor {
  constructor() {
    // Complexity signals for detection
    this.complexitySignals = {
      'Cup of Tea': {
        positive: ['quick', 'simple', 'basic', 'fast', 'easy', 'under 30', 'tiktok ready', 'no edit', 'raw post'],
        negative: ['cinema', 'color grade', 'multi-day', 'stakeholder', 'high budget', 'extensive', 'campaign']
      },
      'Pizza': {
        positive: ['branding', 'logo', 'music', 'platform-specific', 'color grade', 'sound design'],
        negative: ['cinema camera', 'multi-stakeholder', 'extensive direction', 'high-end', 'full production']
      },
      '3-Course Meal': {
        positive: ['cinema', 'full production', 'multi-stakeholder', 'extensive', 'high-end', 'campaign', 'multiple deliverables'],
        negative: []
      }
    };

    // Platform-specific defaults
    this.platformDefaults = {
      'instagram': { aspect_ratio: '9:16', max_duration: '90s', format: 'Reels' },
      'tiktok': { aspect_ratio: '9:16', max_duration: '3min', format: 'TikTok' },
      'youtube': { aspect_ratio: '16:9', format: 'YouTube' },
      'linkedin': { aspect_ratio: '1:1', max_duration: '10min', format: 'LinkedIn' },
      'facebook': { aspect_ratio: '1:1', format: 'Facebook' },
      'twitter': { aspect_ratio: '16:9', max_duration: '2min20s', format: 'Twitter/X' }
    };
  }

  /**
   * Pre-flight analysis - checks brief sanity and suggests corrections
   * TERMINAL ONLY - never shown on Notion page
   */
  async analyze(briefData, providedComplexity) {
    console.log('🧠 Intelligent pre-flight analysis...');
    
    const analysis = {
      useComplexity: providedComplexity,
      smartDefaults: {},
      conflicts: [],
      recommendations: []
    };

    // 1. Detect actual complexity from content
    const detectedComplexity = this.detectComplexity(briefData);
    
    if (detectedComplexity && detectedComplexity !== providedComplexity) {
      console.log(`   ⚠️ Complexity mismatch detected:`);
      console.log(`      Provided: ${providedComplexity}`);
      console.log(`      Detected: ${detectedComplexity}`);
      console.log(`   ✅ Auto-adjusting to ${detectedComplexity}`);
      analysis.useComplexity = detectedComplexity;
    } else {
      console.log(`   ✅ Complexity tier "${providedComplexity}" matches brief content`);
    }

    // 2. Apply smart defaults (silently)
    analysis.smartDefaults = this.applySmartDefaults(briefData);
    if (Object.keys(analysis.smartDefaults).length > 0) {
      console.log(`   📝 Applied ${Object.keys(analysis.smartDefaults).length} smart defaults`);
    }

    // 3. Detect conflicts (natural language for Notion)
    analysis.conflicts = this.detectConflictsNatural(briefData, analysis.useComplexity);
    if (analysis.conflicts.length > 0) {
      console.log(`   ⚠️ Detected ${analysis.conflicts.length} potential conflicts`);
    }

    console.log('✅ Pre-flight analysis complete\n');
    
    return analysis;
  }

  /**
   * Detect actual complexity from brief content
   */
  detectComplexity(briefData) {
    const briefText = JSON.stringify(briefData).toLowerCase();
    
    const scores = {
      'Cup of Tea': 0,
      'Pizza': 0,
      '3-Course Meal': 0
    };

    // Score each complexity tier based on signals
    for (const [tier, signals] of Object.entries(this.complexitySignals)) {
      // Add points for positive signals
      for (const signal of signals.positive) {
        if (briefText.includes(signal.toLowerCase())) {
          scores[tier] += 1;
        }
      }
      
      // Subtract points for negative signals
      for (const signal of signals.negative) {
        if (briefText.includes(signal.toLowerCase())) {
          scores[tier] -= 2; // Negative signals count more
        }
      }
    }

    // Find highest scoring tier
    const sortedTiers = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topTier = sortedTiers[0];
    
    // Only return if score is positive and clearly different
    if (topTier[1] > 0) {
      return topTier[0];
    }
    
    return null; // No clear signal, use provided
  }

  /**
   * Apply smart defaults based on brief context
   * These are populated silently - no markers or technical notes
   */
  applySmartDefaults(briefData) {
    const defaults = {};
    const briefText = JSON.stringify(briefData).toLowerCase();

    // Platform-specific defaults
    for (const [platform, platformDefaults] of Object.entries(this.platformDefaults)) {
      if (briefText.includes(platform)) {
        console.log(`   📝 Detected platform: ${platform.toUpperCase()}`);
        
        if (!this.findFieldValue(briefData, 'aspect_ratio') && platformDefaults.aspect_ratio) {
          defaults.aspect_ratio = platformDefaults.aspect_ratio;
          console.log(`      → Aspect ratio: ${platformDefaults.aspect_ratio}`);
        }
        
        if (!this.findFieldValue(briefData, 'format') && platformDefaults.format) {
          defaults.format = platformDefaults.format;
          console.log(`      → Format: ${platformDefaults.format}`);
        }
        
        break; // Use first matching platform
      }
    }

    // "Quick" signals
    if (briefText.includes('quick') || briefText.includes('fast') || briefText.includes('simple')) {
      if (!this.findFieldValue(briefData, 'editing_style')) {
        defaults.editing_style = 'Fast turnaround - basic cuts and transitions';
        console.log(`   📝 Detected "quick" request → Applied minimal editing style`);
      }
    }

    // "Professional" or "high-end" signals
    if (briefText.includes('professional') || briefText.includes('high-end') || briefText.includes('premium')) {
      if (!this.findFieldValue(briefData, 'quality_level')) {
        defaults.quality_level = 'Premium production quality';
        console.log(`   📝 Detected quality expectations → Applied premium standard`);
      }
    }

    // Social media defaults
    if (briefText.includes('social media') || briefText.includes('social post')) {
      if (!this.findFieldValue(briefData, 'captions_needed')) {
        defaults.captions_needed = 'Yes (for accessibility)';
        console.log(`   📝 Social media content → Captions recommended`);
      }
    }

    return defaults;
  }

  /**
   * Detect FACTUAL contradictions in the brief (NOT system opinions/assessments)
   * ONLY flag actual contradictions in the brief data itself
   * IE7 TEAM FILTER: Only include if it helps them execute the work
   */
  detectConflictsNatural(briefData, complexity) {
    const conflicts = [];
    const briefText = JSON.stringify(briefData).toLowerCase();

    // REMOVED: Timeline vs Scope assessment (that's IE7's judgment to make, not ours)
    // REMOVED: Budget vs Scope assessment (that's IE7's business decision, not ours)
    // REMOVED: Quality vs Timeline assessment (that's IE7's call)
    
    // ONLY KEEP: Factual contradictions
    
    // 1. Platform format contradiction (FACTUAL - requires multiple cuts)
    const platforms = this.findFieldValue(briefData, 'platforms');
    const platformText = typeof platforms === 'string' ? platforms : JSON.stringify(platforms || '');
    
    if (platformText) {
      const hasVertical = platformText.toLowerCase().includes('instagram') || 
                         platformText.toLowerCase().includes('tiktok') ||
                         platformText.toLowerCase().includes('reels') ||
                         platformText.toLowerCase().includes('stories');
      
      const hasHorizontal = platformText.toLowerCase().includes('youtube') || 
                           platformText.toLowerCase().includes('linkedin') ||
                           platformText.toLowerCase().includes('vimeo');
      
      if (hasVertical && hasHorizontal) {
        conflicts.push({
          type: 'platform_format',
          emoji: '📱',
          title: 'Multi-Format Requirement',
          message: `This project includes platforms requiring different formats (vertical 9:16 for Instagram/TikTok and horizontal 16:9 for YouTube/LinkedIn). Multiple cuts will be delivered.`
        });
        console.log(`   📱 Note: Multi-format delivery required`);
      }
    }

    // 2. Duration contradictions (FACTUAL - conflicting requirements in brief)
    // Example: "30 seconds" mentioned in one place, "60 seconds" in another
    const durationMatches = briefText.match(/(\d+)\s*(second|sec|min)/gi) || [];
    const uniqueDurations = [...new Set(durationMatches.map(d => d.toLowerCase()))];
    
    if (uniqueDurations.length > 1) {
      conflicts.push({
        type: 'duration_contradiction',
        emoji: '⏱️',
        title: 'Duration Clarification',
        message: `Multiple durations mentioned in brief: ${uniqueDurations.join(', ')}. Please confirm which is correct.`
      });
      console.log(`   ⏱️ Contradiction: Multiple durations found`);
    }

    // Future: Add more FACTUAL contradiction detection here
    // (e.g., conflicting aspect ratios, contradictory dates, etc.)

    return conflicts;
  }

  /**
   * Check if brief is urgent
   */
  isUrgent(briefData) {
    const briefText = JSON.stringify(briefData).toLowerCase();
    const urgentSignals = ['today', 'tomorrow', 'asap', 'urgent', 'immediately', '24 hours', 'by eod'];
    
    return urgentSignals.some(signal => briefText.includes(signal));
  }

  /**
   * Check if brief has complex scope
   */
  isComplexScope(briefData, complexity) {
    if (complexity === '3-Course Meal') return true;
    
    const briefText = JSON.stringify(briefData).toLowerCase();
    const complexSignals = [
      'multi-day', 'multiple deliverables', 'stakeholder', 
      'campaign', 'cinema', 'extensive', 'full production'
    ];
    
    return complexSignals.some(signal => briefText.includes(signal));
  }

  /**
   * Find field value in nested brief data
   */
  findFieldValue(briefData, fieldKey) {
    const possibleKeys = [
      fieldKey,
      fieldKey.toLowerCase(),
      fieldKey.replace(/_/g, ' '),
      fieldKey.replace(/_/g, '').toLowerCase()
    ];

    for (const key of possibleKeys) {
      if (briefData[key]) return briefData[key];
    }

    // Check nested objects
    for (const value of Object.values(briefData)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nestedValue = this.findFieldValue(value, fieldKey);
        if (nestedValue) return nestedValue;
      }
    }

    return null;
  }
}

module.exports = IntelligentProcessor;

