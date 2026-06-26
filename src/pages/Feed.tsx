import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FeedService } from '@/sdk/FeedService'
import { UserService } from '@/sdk/UserService'
import { Post, User } from '@/types'
import { PostCreator } from '@/components/feed/PostCreator'
import { PostCard } from '@/components/feed/PostCard'
import { Spinner } from '@/components/ui/spinner'
import { Users, Rocket } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function Feed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, User>>({})
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [fetchedPosts, allUsers] = await Promise.all([
        FeedService.getPosts(),
        UserService.getAll()
      ])

      const map: Record<string, User> = {}
      allUsers.forEach(u => { map[u.id] = u })

      setPosts(fetchedPosts)
      setUsersMap(map)
    } catch (error) {
      logger.error('Error loading feed data', { error })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreatePost = async (content: string, category: string, imageUrls: string[]) => {
    if (!user) return
    try {
      await FeedService.createPost({
        authorId: user.id,
        content,
        category: category as any,
        imageUrls
      })
      await loadData() // reload to show new post
    } catch (error) {
      logger.error('Error in handleCreatePost', { error })
    }
  }

  if (loading) {
    return <Spinner className="min-h-[50vh]" />
  }

  return (
    <div className="page-shell max-w-3xl mx-auto">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Rocket className="w-8 h-8 text-cyan-400" />
            Cubesat Network
          </h1>
          <p className="page-copy">
            Comparte actualizaciones, logros y descubre oportunidades en la industria espacial.
          </p>
        </div>
      </div>

      <PostCreator onPostCreated={handleCreatePost} />
      
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-10 bg-space-800/50 rounded-xl border border-space-600">
            <Users className="w-12 h-12 text-space-400 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Aún no hay publicaciones. ¡Sé el primero en compartir algo!</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              author={usersMap[post.authorId]} 
              currentUserId={user?.id || ''}
              usersMap={usersMap}
            />
          ))
        )}
      </div>
    </div>
  )
}
