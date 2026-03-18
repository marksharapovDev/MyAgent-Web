export type DesignVariant = 1 | 2 | 3;

export type DesignStatus = 'pending' | 'approved' | 'rejected';

export interface DesignRequirements {
  businessType: string;
  colorScheme?: string;
  style?: string;
  sections: string[];
  references?: string[];
  notes?: string;
}

export interface DesignRequest {
  projectId: string;
  taskId: string;
  requirements: DesignRequirements;
  variant?: DesignVariant;
  feedbackFrom?: string;
}

export interface DesignVersion {
  id: string;
  taskId: string;
  projectId: string;
  version: number;
  variant: DesignVariant;
  htmlCode: string;
  screenshotUrl?: string;
  feedback?: string;
  status: DesignStatus;
  createdAt: Date;
}

export interface DesignResult {
  versions: DesignVersion[];
  screenshotUrls: string[];
  selectedVariant?: DesignVariant;
}

export interface DesignFeedback {
  designVersionId: string;
  feedback: string;
  approved: boolean;
}
