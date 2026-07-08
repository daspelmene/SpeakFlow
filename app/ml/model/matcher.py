import torch
from sentence_transformers import SentenceTransformer, util


class SemanticMatcher:
    def __init__(self, model_name="all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)

    def rank_candidates(self, target_user, candidates, top_k=5):
        clean_candidates = [c for c in candidates if c.id != target_user.id]

        if not clean_candidates:
            return []

        target_text = f"Interests: {', '.join(target_user.interests)}. Bio: {target_user.bio}"
        candidate_texts = [
            f"Interests: {', '.join(c.interests)}. Bio: {c.bio}"
            for c in clean_candidates
        ]

        target_vector = self.model.encode(target_text, convert_to_tensor=True)
        candidates_vectors = self.model.encode(candidate_texts, convert_to_tensor=True)
        cosine_scores = util.cos_sim(target_vector, candidates_vectors)[0]
        noise = torch.randn(cosine_scores.size()) * 0.0001
        noisy_scores = cosine_scores + noise
        num_results = min(top_k, len(clean_candidates))
        top_results = torch.topk(noisy_scores, k=num_results)

        matches = []
        for score, cand_idx in zip(top_results.values, top_results.indices):
            match_user = candidates[cand_idx]

            matches.append({
                "user_id": match_user.id,
                "name": getattr(match_user, "name", "Unknown"),
                "similarity_score": round(score.item() * 100, 1),
                "target_level": getattr(match_user, "target_level", "Unknown"),
                "interests": match_user.interests,
                "bio": match_user.bio
            })

        return matches