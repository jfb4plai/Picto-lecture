import { useEffect, useState } from 'react';
import { BookOpen, Trash2, Eye } from 'lucide-react';
import { supabase, Story } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type StoriesListProps = {
  onStorySelect: (story: Story) => void;
  refreshTrigger: number;
};

export const StoriesList = ({ onStorySelect, refreshTrigger }: StoriesListProps) => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
  }, [user, refreshTrigger]);

  const loadStories = async () => {
    if (!user) return;

    setLoading(true);
    const { data } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setStories(data);
    }
    setLoading(false);
  };

  const deleteStory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer cette histoire ?')) return;

    await supabase.from('stories').delete().eq('id', id);
    setStories(stories.filter((s) => s.id !== id));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        Chargement...
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
        Aucune histoire sauvegardée
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <BookOpen className="w-5 h-5 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-800">Mes histoires</h2>
      </div>

      <div className="space-y-3">
        {stories.map((story) => (
          <div
            key={story.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition cursor-pointer group"
            onClick={() => onStorySelect(story)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-800 group-hover:text-blue-600 transition">
                  {story.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(story.created_at).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                  {story.original_text.substring(0, 100)}...
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStorySelect(story);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Voir"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => deleteStory(story.id, e)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
