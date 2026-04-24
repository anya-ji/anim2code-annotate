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

export interface Annotation {
  comparison_index: number
  match_choice: Choice
  appearance_choice: Choice
  motion_choice: Choice
  annotated_at: string
}

export interface ParticipantData {
  study_id: string
  session_id: string
  started_at: string
  completed_at: string | null
  current_index: number // display index (0–31)
  annotations: Annotation[]
  passed_attn_check?: boolean
  passed_implicit_attn_check?: boolean
  implicit_attn_round?: number
  implicit_attn_insert_pos: number
  implicit_attn_target_index: number
}

export interface TrialDoc {
  id: string
  comparisons: Comparison[]
  participants: Record<string, ParticipantData>
}

export interface ParticipantResponse {
  trialId: string
  comparisons: Comparison[]
  currentIndex: number // display index (0–31)
  annotations: Annotation[]
  completed: boolean
  implicitAttnInsertPos: number
  implicitAttnTargetIndex: number
}
