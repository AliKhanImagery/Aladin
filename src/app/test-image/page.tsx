'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Image, Loader2, Plus, X } from 'lucide-react'

export default function TestImagePage() {
  const [model, setModel] = useState<'openai' | 'fal-ai'>('openai')
  const [prompt, setPrompt] = useState('A cinematic shot of a vintage car driving on a scenic mountain road at sunset')
  const [referenceUrls, setReferenceUrls] = useState<string[]>([''])
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setGeneratedImage(null)

    try {
      if (model === 'openai') {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: 'dall-e-3',
            size: '1024x1024',
            quality: 'hd',
          }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to generate')
        }

        const { imageUrl } = await response.json()
        setGeneratedImage(imageUrl)
      } else {
        const validRefs = referenceUrls.filter(url => url.trim() !== '')
        if (validRefs.length === 0) {
          throw new Error('At least one reference image URL is required')
        }

        const response = await fetch('/api/generate-image-fal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            reference_image_urls: validRefs,
            aspect_ratio: '16:9',
          }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to generate')
        }

        const { imageUrl } = await response.json()
        setGeneratedImage(imageUrl)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const addReferenceUrl = () => setReferenceUrls([...referenceUrls, ''])
  const updateReferenceUrl = (index: number, value: string) => {
    const updated = [...referenceUrls]
    updated[index] = value
    setReferenceUrls(updated)
  }
  const removeReferenceUrl = (index: number) => {
    setReferenceUrls(referenceUrls.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Image Generation Test</h1>
          <p className="text-gray-400">Test OpenAI DALL-E and Fal AI Vidu image generation</p>
        </div>

        <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={model === 'openai' ? 'default' : 'outline'}
                onClick={() => setModel('openai')}
                className={model === 'openai' ? 'bg-[#00FFF0] text-black' : ''}
              >
                OpenAI DALL-E 3
              </Button>
              <Button
                variant={model === 'fal-ai' ? 'default' : 'outline'}
                onClick={() => setModel('fal-ai')}
                className={model === 'fal-ai' ? 'bg-[#00FFF0] text-black' : ''}
              >
                Fal AI Vidu
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Prompt</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image..."
              className="w-full h-32 bg-[#0C0C0C] border-[#3AAFA9] text-white"
            />
          </div>

          {model === 'fal-ai' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reference Image URLs (for consistent characters)
              </label>
              <div className="space-y-2">
                {referenceUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={url}
                      onChange={(e) => updateReferenceUrl(index, e.target.value)}
                      placeholder="https://example.com/reference.png"
                      className="bg-[#0C0C0C] border-[#3AAFA9] text-white"
                    />
                    {referenceUrls.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeReferenceUrl(index)}
                        className="text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addReferenceUrl}
                  className="border-[#3AAFA9] text-[#3AAFA9]"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Reference
                </Button>
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold py-3 rounded-lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Image className="w-4 h-4 mr-2" />
                Generate Image
              </>
            )}
          </Button>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              Error: {error}
            </div>
          )}
        </div>

        {generatedImage && (
          <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
            <h2 className="text-xl font-semibold mb-4">Generated Image</h2>
            <div className="bg-[#0C0C0C] rounded-lg p-4">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full rounded-lg"
              />
            </div>
            <div className="mt-4">
              <a
                href={generatedImage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00FFF0] hover:underline"
              >
                Open in new tab
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

