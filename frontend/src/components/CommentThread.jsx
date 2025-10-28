import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

function CommentItem({ comment, replies, onReply, showReplyForm, replyText, onReplyTextChange, onAddReply, onCancelReply }) {
  return (
    <div className="border-l-2 border-gray-200 pl-3">
      <div className="flex items-start space-x-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900">{comment.user_name}</span>
            <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1 text-left">{comment.comment}</p>
          <button
            onClick={onReply}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1  "
          >
            Reply
          </button>
        </div>
      </div>

      {showReplyForm && (
        <div className="mt-2 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder="Write a reply..."
            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
            rows={2}
          />
          <div className="flex space-x-2">
            <button
              onClick={onAddReply}
              className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-blue-700"
            >
              Post Reply
            </button>
            <button
              onClick={onCancelReply}
              className="bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-xs font-medium hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="mt-3 ml-4 space-y-2">
          {replies.map(reply => (
            <div key={reply.id} className="border-l-2 border-gray-100 pl-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{reply.user_name}</span>
                <span className="text-xs text-gray-500">{new Date(reply.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1 text-left">{reply.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentThread({ contractId, versionId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    loadComments();
  }, [versionId]);

  const loadComments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/contracts/${contractId}/versions/${versionId}/comments`);
      setComments(res.data.comments);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const addComment = async (parentId = null) => {
    if (!newComment.trim()) return;

    try {
      await axios.post(`${API_BASE}/contracts/${contractId}/versions/${versionId}/comments`, {
        comment: newComment,
        parent_comment_id: parentId
      });
      setNewComment('');
      setReplyingTo(null);
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    }
  };

  const addReply = async (parentId) => {
    if (!replyText.trim()) return;

    try {
      await axios.post(`${API_BASE}/contracts/${contractId}/versions/${versionId}/comments`, {
        comment: replyText,
        parent_comment_id: parentId
      });
      setReplyText('');
      setReplyingTo(null);
      loadComments();
    } catch (error) {
      console.error('Error adding reply:', error);
      alert('Failed to add reply');
    }
  };

  const rootComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_comment_id === parentId);

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Comments</h4>
      
      <div className="space-y-4 mb-4">
        {rootComments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={getReplies(comment.id)}
            onReply={() => setReplyingTo(comment.id)}
            showReplyForm={replyingTo === comment.id}
            replyText={replyText}
            onReplyTextChange={setReplyText}
            onAddReply={() => addReply(comment.id)}
            onCancelReply={() => {
              setReplyingTo(null);
              setReplyText('');
            }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          rows={3}
        />
        <button
          onClick={() => addComment()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Post Comment
        </button>
      </div>
    </div>
  );
}

