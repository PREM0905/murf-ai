import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Photo {
  id: string;
  url: string;
  caption: string;
  date: string;
}

const PhotoGallery = () => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newPhoto: Photo = {
          id: Date.now().toString(),
          url: e.target?.result as string,
          caption: "New photo",
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        };
        setPhotos([newPhoto, ...photos]);
        toast({
          title: "Photo uploaded",
          description: "Your photo has been added to the gallery",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const deletePhoto = (id: string) => {
    setPhotos(photos.filter(photo => photo.id !== id));
    toast({
      title: "Photo deleted",
      description: "Photo removed from gallery",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Progress Photos</h2>
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          <label className="cursor-pointer">
            Upload Photo
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <Card key={photo.id} className="overflow-hidden group relative">
            <div className="aspect-square overflow-hidden">
              <img
                src={photo.url}
                alt={photo.caption}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <div className="p-4">
              <p className="font-medium text-foreground">{photo.caption}</p>
              <p className="text-sm text-muted-foreground mt-1">{photo.date}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deletePhoto(photo.id)}
              className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PhotoGallery;
