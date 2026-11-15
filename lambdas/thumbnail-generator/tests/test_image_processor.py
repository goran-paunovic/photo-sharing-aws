from io import BytesIO
from PIL import Image
from handler import make_webp
def test_make_webp_resizes_image():
    source=Image.new('RGB',(1200,800),'navy'); buf=BytesIO(); source.save(buf,format='JPEG')
    result=make_webp(buf.getvalue(),(240,240))
    with Image.open(BytesIO(result)) as image:
        assert image.format=='WEBP'
        assert image.size==(240,160)
