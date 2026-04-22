export interface Comparison {
  index: number
  video_name: string
  ground_truth_url: string
  left_model: string
  left_url: string
  right_model: string
  right_url: string
}

export type Choice = "left" | "right" | "same"
export type SameDetail = "exact" | "similar"

export interface Annotation {
  comparison_index: number
  match_choice: Choice
  match_same_detail?: SameDetail
  match_reason?: string
  appearance_choice: Choice
  appearance_same_detail?: SameDetail
  appearance_reason?: string
  motion_choice: Choice
  motion_same_detail?: SameDetail
  motion_reason?: string
  annotated_at: string
}

export interface ParticipantData {
  study_id: string
  session_id: string
  started_at: string
  completed_at: string | null
  current_index: number
  annotations: Annotation[]
}

export interface TrialDoc {
  id: string
  comparisons: Comparison[]
  participants: Record<string, ParticipantData>
}

export interface ParticipantResponse {
  trialId: string
  comparisons: Comparison[]
  currentIndex: number
  annotations: Annotation[]
  completed: boolean
}
