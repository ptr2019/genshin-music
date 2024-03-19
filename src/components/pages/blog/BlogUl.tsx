import {MaybeChildren, Stylable} from "$lib/UtilTypes";
import s from './blog.module.scss'

export function BlogUl({children, ...rest}: MaybeChildren<Stylable>) {
    return <ul {...rest}>
        {children}
    </ul>
}
export function BlogOl({children, className, ...rest}: MaybeChildren<Stylable>) {
    return <ol {...rest} className={`${className} ${s['blog-ol']}`}>
        {children}
    </ol>
}

export function BlogLi({children, style, ...rest}: MaybeChildren<Stylable>) {
    return <li
        style={{
            margin: '0.5rem 0',
            ...style
        }}
        {...rest}
    >
        {children}
    </li>
}