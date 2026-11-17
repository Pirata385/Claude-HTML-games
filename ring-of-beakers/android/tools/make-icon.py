import sys
from PIL import Image, ImageDraw
S=4; N=192*S
im=Image.new('RGBA',(N,N),(0,0,0,0)); d=ImageDraw.Draw(im)
c=N//2
d.ellipse([8*S,8*S,N-8*S,N-8*S],fill=(46,38,64,255))                  # plum disc
d.ellipse([22*S,22*S,N-22*S,N-22*S],outline=(240,196,82,255),width=12*S)  # gold ring
# beaker (Erlenmeyer flask)
neck_w=26*S; top=50*S; neck_b=88*S; base=146*S; half=46*S
flask=[(c-neck_w//2,top),(c+neck_w//2,top),(c+neck_w//2,neck_b),(c+half,base),(c-half,base),(c-neck_w//2,neck_b)]
d.polygon(flask,fill=(235,240,245,255))
liq=[(c-31*S,118*S),(c+31*S,118*S),(c+half-3*S,base-3*S),(c-half+3*S,base-3*S)]
d.polygon(liq,fill=(237,104,90,255))
d.line(flask+[flask[0]],fill=(30,26,40,255),width=5*S,joint='curve')
d.rectangle([c-neck_w//2-6*S,top-8*S,c+neck_w//2+6*S,top],fill=(30,26,40,255))
for x,y,r in [(c-12*S,132*S,5*S),(c+10*S,126*S,4*S),(c+2*S,104*S,3*S)]:
    d.ellipse([x-r,y-r,x+r,y+r],fill=(255,230,220,255))
im=im.resize((192,192),Image.LANCZOS); im.save(sys.argv[1])
